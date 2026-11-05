import { HttpFn, HttpRequest, isRecord, joinUrl, parseJson, send, WikiApiError } from '../http';
import { BaseWikiClient } from '../base-client';
import { ConnectionInfo, PageInput, RemotePage, UploadedAsset } from '../types';
import { pathHash } from './path-hash';

interface Site {
	id: string;
	title: string;
}

interface Page {
	id: string;
	path: string;
	title: string;
}

interface Asset {
	fileName: string;
	folderPath: string;
}

/** Wiki.js 3.x client, over its REST API (`/_api`, OpenAPI spec at `/_api/json`). */
export class V3Client extends BaseWikiClient {
	readonly version = 'v3';
	private site?: Promise<Site>;

	constructor(
		private readonly http: HttpFn,
		private readonly baseUrl: string,
		private readonly token: string,
		private readonly locale: string,
	) {
		super();
	}

	async checkConnection(): Promise<ConnectionInfo> {
		const site = await this.getSite();
		// Cheapest route that requires a valid token with the `pages` scope
		await this.request('GET', `/sites/${site.id}/pages/search?limit=1`);
		return { version: 'v3', site: site.title };
	}

	async getPageByPath(path: string): Promise<RemotePage | null> {
		const site = await this.getSite();
		const query = this.locale ? `?locale=${encodeURIComponent(this.locale)}` : '';
		try {
			const page = (await this.request('GET', `/sites/${site.id}/pages/${pathHash(path)}${query}`)) as Page;
			return this.toRemotePage(page);
		} catch (error) {
			if (error instanceof WikiApiError && error.status === 404) return null;
			throw error;
		}
	}

	async createPage(input: PageInput): Promise<RemotePage> {
		const site = await this.getSite();
		const result = (await this.request('POST', `/sites/${site.id}/pages`, {
			...this.toPageBody(input),
			path: input.path,
			editor: 'markdown',
			...(this.locale && { locale: this.locale }),
		})) as { page: Page };
		return this.render(result.page);
	}

	async updatePage(id: string, input: PageInput): Promise<RemotePage> {
		const site = await this.getSite();
		// The Markdown and Visual editors share the same Markdown source, so the editor is left as is
		const result = (await this.request('PATCH', `/sites/${site.id}/pages/${id}`, this.toPageBody(input))) as {
			page: Page;
		};
		return this.render(result.page);
	}

	async deletePage(id: string): Promise<void> {
		const site = await this.getSite();
		await this.request('DELETE', `/sites/${site.id}/pages/${id}`);
	}

	async uploadAsset(folderPath: string, fileName: string, data: ArrayBuffer, mimeType: string): Promise<UploadedAsset> {
		const site = await this.getSite();
		const query = new URLSearchParams({ fileName });
		if (folderPath) query.set('folderPath', folderPath);
		// Raw body, not multipart. A file with the same name is overwritten (the default conflict behaviour).
		const result = (await this.request('POST', `/sites/${site.id}/assets?${query.toString()}`, data, mimeType)) as {
			asset: Asset;
		};
		const { fileName: storedName, folderPath: storedFolder } = result.asset;
		return {
			fileName: storedName,
			path: `/_files/${storedFolder ? `${storedFolder}/` : ''}${storedName}`,
		};
	}

	/** The site served at the configured URL (Wiki.js resolves it from the hostname). */
	private getSite(): Promise<Site> {
		this.site ??= this.request('GET', '/sites/current').then((site) => site as Site);
		return this.site;
	}

	private toPageBody(input: PageInput) {
		return {
			title: input.title,
			content: input.content,
			description: input.description ?? '',
			tags: input.tags ?? [],
		};
	}

	/** v3 does not render Markdown on save: queue a server-side render, which needs Puppeteer on the server. */
	private async render(page: Page): Promise<RemotePage> {
		const site = await this.getSite();
		const remotePage = this.toRemotePage(page);
		try {
			await this.request('POST', `/sites/${site.id}/pages/${page.id}/render`);
		} catch (error) {
			if (!(error instanceof WikiApiError) || error.status === 401) throw error;
			remotePage.warning = `The page was saved but Wiki.js could not render it, so it may look empty until edited on the wiki (${error.message})`;
		}
		return remotePage;
	}

	private toRemotePage(page: Page): RemotePage {
		return { id: page.id, path: page.path, title: page.title, url: joinUrl(this.baseUrl, `/${page.path}`) };
	}

	private async request(
		method: HttpRequest['method'],
		path: string,
		body?: unknown,
		contentType = 'application/json',
	): Promise<unknown> {
		const raw = body instanceof ArrayBuffer;
		const response = await send(this.http, {
			url: joinUrl(this.baseUrl, `/_api${path}`),
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				// Fastify rejects a JSON content type with an empty body
				...(body !== undefined && { 'Content-Type': contentType }),
			},
			body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
		});
		const result = parseJson(response);
		if (response.status < 400) return result;

		const reason = isRecord(result) && typeof result.message === 'string' ? result.message : `HTTP ${response.status}`;
		switch (response.status) {
			case 401:
				throw new WikiApiError(`Wiki.js rejected the token: ${reason}`, 401);
			case 403:
				throw new WikiApiError(
					`The token is missing a scope or permission (it needs pages:write and assets:write): ${reason}`,
					403,
				);
			default:
				throw new WikiApiError(`Wiki.js error: ${reason}`, response.status);
		}
	}
}
