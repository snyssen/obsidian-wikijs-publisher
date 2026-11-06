import { fileTooLarge, HttpFn, isRecord, joinUrl, parseJson, send, WikiApiError } from '../http';
import { BaseWikiClient } from '../base-client';
import { ConnectionInfo, PageInput, RemotePage, UploadedAsset } from '../types';
import { buildMultipart } from './multipart';

// Error code of `pages.singleByPath` when there is no page at the path
const PAGE_NOT_FOUND = 6003;

interface ResponseResult {
	succeeded: boolean;
	message: string;
}

interface Page {
	id: number;
	path: string;
	title: string;
}

interface Folder {
	id: number;
	slug: string;
}

const PAGE_FIELDS = 'id path title';

class GraphqlError extends WikiApiError {
	constructor(
		message: string,
		readonly codes: number[],
	) {
		super(message);
	}
}

/** Wiki.js 2.x client, over its GraphQL API. */
export class V2Client extends BaseWikiClient {
	readonly version = 'v2';
	private readonly locale: string;
	/** Asset folder ids by folder path. */
	private readonly folderIds = new Map<string, Promise<number>>([['', Promise.resolve(0)]]);

	constructor(
		private readonly http: HttpFn,
		private readonly baseUrl: string,
		private readonly token: string,
		locale: string,
	) {
		super();
		this.locale = locale || 'en';
	}

	async checkConnection(): Promise<ConnectionInfo> {
		// Admin-only query: also confirms the key has the full access the plugin needs
		const data = await this.graphql<{ system: { info: { currentVersion: string } } }>(
			'{ system { info { currentVersion } } }',
		);
		return { version: 'v2', serverVersion: data.system.info.currentVersion };
	}

	async getPageByPath(path: string): Promise<RemotePage | null> {
		try {
			const data = await this.graphql<{ pages: { singleByPath: Page } }>(
				`query ($path: String!, $locale: String!) { pages { singleByPath(path: $path, locale: $locale) { ${PAGE_FIELDS} } } }`,
				{ path, locale: this.locale },
			);
			return this.toRemotePage(data.pages.singleByPath);
		} catch (error) {
			if (error instanceof GraphqlError && error.codes.includes(PAGE_NOT_FOUND)) return null;
			throw error;
		}
	}

	async createPage(input: PageInput): Promise<RemotePage> {
		const data = await this.graphql<{ pages: { create: { responseResult: ResponseResult; page: Page } } }>(
			`mutation ($path: String!, $title: String!, $content: String!, $description: String!, $tags: [String]!, $locale: String!) {
				pages { create(path: $path, title: $title, content: $content, description: $description, tags: $tags, locale: $locale,
					editor: "markdown", isPublished: true, isPrivate: false) {
					responseResult { succeeded message } page { ${PAGE_FIELDS} } } } }`,
			{ ...this.toPageVariables(input), path: input.path, locale: this.locale },
		);
		checkResult(data.pages.create.responseResult);
		return this.toRemotePage(data.pages.create.page);
	}

	async updatePage(id: string, input: PageInput): Promise<RemotePage> {
		// The editor is forced to Markdown: the content we send is Markdown, whatever the page was written with.
		// isPublished must be sent too: when left out, Wiki.js 2 unpublishes the page.
		const data = await this.graphql<{ pages: { update: { responseResult: ResponseResult; page: Page } } }>(
			`mutation ($id: Int!, $title: String!, $content: String!, $description: String!, $tags: [String]!) {
				pages { update(id: $id, title: $title, content: $content, description: $description, tags: $tags,
					editor: "markdown", isPublished: true, isPrivate: false) {
					responseResult { succeeded message } page { ${PAGE_FIELDS} } } } }`,
			{ ...this.toPageVariables(input), id: toIntId(id) },
		);
		checkResult(data.pages.update.responseResult);
		return this.toRemotePage(data.pages.update.page);
	}

	async deletePage(id: string): Promise<void> {
		const data = await this.graphql<{ pages: { delete: { responseResult: ResponseResult } } }>(
			'mutation ($id: Int!) { pages { delete(id: $id) { responseResult { succeeded message } } } }',
			{ id: toIntId(id) },
		);
		checkResult(data.pages.delete.responseResult);
	}

	async movePage(id: string, path: string): Promise<void> {
		const data = await this.graphql<{ pages: { move: { responseResult: ResponseResult } } }>(
			'mutation ($id: Int!, $path: String!, $locale: String!) { pages { move(id: $id, destinationPath: $path, destinationLocale: $locale) { responseResult { succeeded message } } } }',
			{ id: toIntId(id), path, locale: this.locale },
		);
		checkResult(data.pages.move.responseResult);
	}

	async uploadAsset(folderPath: string, fileName: string, data: ArrayBuffer, mimeType: string): Promise<UploadedAsset> {
		const folderId = await this.getFolderId(folderPath);
		// The `mediaUpload` field is sent twice: first the target folder, then the file
		const { body, contentType } = buildMultipart([
			{ name: 'mediaUpload', value: JSON.stringify({ folderId }) },
			{ name: 'mediaUpload', fileName, mimeType, data },
		]);
		const response = await send(this.http, {
			url: joinUrl(this.baseUrl, '/u'),
			method: 'POST',
			headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': contentType },
			body,
		});
		if (response.status !== 200) {
			// Upload errors come as an HTML error page, with the reason in a <span>
			const reason = /<span>([^<]+)<\/span>/.exec(response.text)?.[1]?.trim();
			if (reason === 'File too large') throw fileTooLarge(response.status);
			const isHtml = response.text.trimStart().startsWith('<');
			throw new WikiApiError(
				`Wiki.js could not store ${fileName}: ${reason ?? (isHtml || !response.text ? `HTTP ${response.status}` : response.text)}`,
				response.status,
			);
		}

		// The upload only answers "ok", and Wiki.js may have renamed the file (lowercased, spaces replaced)
		const listing = await this.graphql<{ assets: { list: { filename: string }[] } }>(
			'query ($folderId: Int!) { assets { list(folderId: $folderId, kind: ALL) { filename } } }',
			{ folderId },
		);
		const expected = fileName.toLowerCase().replace(/\s+/g, '_');
		const stored = listing.assets.list.find((asset) => asset.filename === expected);
		if (!stored) throw new WikiApiError(`${fileName} was uploaded but could not be found on the wiki`);
		return { fileName: stored.filename, path: `/${folderPath ? `${folderPath}/` : ''}${stored.filename}` };
	}

	/** Id of the asset folder at `folderPath`, creating missing folders along the way. */
	private getFolderId(folderPath: string): Promise<number> {
		let id = this.folderIds.get(folderPath);
		if (!id) {
			const slash = folderPath.lastIndexOf('/');
			const parentPath = slash === -1 ? '' : folderPath.slice(0, slash);
			const slug = folderPath.slice(slash + 1);
			id = this.getFolderId(parentPath).then((parentId) => this.findOrCreateFolder(parentId, slug));
			// Don't cache failures, so a later call can retry
			id.catch(() => this.folderIds.delete(folderPath));
			this.folderIds.set(folderPath, id);
		}
		return id;
	}

	private async findOrCreateFolder(parentId: number, slug: string): Promise<number> {
		const find = async () => {
			const data = await this.graphql<{ assets: { folders: Folder[] } }>(
				'query ($parentId: Int!) { assets { folders(parentFolderId: $parentId) { id slug } } }',
				{ parentId },
			);
			return data.assets.folders.find((folder) => folder.slug === slug)?.id;
		};

		const existing = await find();
		if (existing !== undefined) return existing;

		const data = await this.graphql<{ assets: { createFolder: { responseResult: ResponseResult } } }>(
			'mutation ($parentId: Int!, $slug: String!) { assets { createFolder(parentFolderId: $parentId, slug: $slug, name: $slug) { responseResult { succeeded message } } } }',
			{ parentId, slug },
		);
		checkResult(data.assets.createFolder.responseResult);
		const created = await find();
		if (created === undefined) throw new WikiApiError(`The asset folder ${slug} was created but could not be found`);
		return created;
	}

	private toPageVariables(input: PageInput) {
		return {
			title: input.title,
			content: input.content,
			description: input.description ?? '',
			tags: input.tags ?? [],
		};
	}

	private toRemotePage(page: Page): RemotePage {
		return { id: String(page.id), path: page.path, title: page.title, url: joinUrl(this.baseUrl, `/${page.path}`) };
	}

	private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		const response = await send(this.http, {
			url: joinUrl(this.baseUrl, '/graphql'),
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({ query, variables }),
		});
		const result = parseJson(response);
		if (!isRecord(result)) {
			throw new WikiApiError(`Unexpected response from Wiki.js (HTTP ${response.status})`, response.status);
		}

		// GraphQL reports errors with HTTP 200, an invalid or under-privileged key included
		const errors = (Array.isArray(result.errors) ? result.errors : []).filter(isRecord);
		if (errors.length > 0) {
			const message = errors.map((e) => String(e.message)).join('; ');
			if (message === 'Forbidden') {
				throw new WikiApiError('Wiki.js rejected the API key: check that it is valid and has full access', 403);
			}
			const codes = errors.map((e) => errorCode(e)).filter((code): code is number => code !== undefined);
			throw new GraphqlError(`Wiki.js error: ${message}`, codes);
		}
		return result.data as T;
	}
}

function errorCode(error: Record<string, unknown>): number | undefined {
	const extensions = error.extensions;
	if (!isRecord(extensions) || !isRecord(extensions.exception)) return undefined;
	const code = extensions.exception.code;
	return typeof code === 'number' ? code : undefined;
}

function checkResult(result: ResponseResult): void {
	if (!result.succeeded) throw new WikiApiError(`Wiki.js error: ${result.message}`);
}

function toIntId(id: string): number {
	const value = Number(id);
	if (!Number.isInteger(value)) throw new WikiApiError(`Invalid Wiki.js 2 page id: ${id}`);
	return value;
}
