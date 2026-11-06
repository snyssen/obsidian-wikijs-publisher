export type WikiVersion = 'v2' | 'v3';

export interface WikiConfig {
	url: string;
	token: string;
	/** `auto` detects the version from the server. */
	version: WikiVersion | 'auto';
	/** Locale of the pages; empty for the wiki's default. */
	locale: string;
}

export interface ConnectionInfo {
	version: WikiVersion;
	/** Exact server version, when the API exposes it to the token. */
	serverVersion?: string;
	/** Site title (v3 can serve several sites). */
	site?: string;
}

export interface PageInput {
	/** Wiki path without leading slash, already valid for Wiki.js (see `toWikiPath`). */
	path: string;
	title: string;
	/** Markdown source. */
	content: string;
	description?: string;
	tags?: string[];
}

export interface RemotePage {
	/** Wiki.js page id: an integer on v2, a UUID on v3. */
	id: string;
	path: string;
	title: string;
	/** Absolute URL of the page. */
	url: string;
	/** Set when the page was saved but something non-fatal went wrong, e.g. it could not be rendered. */
	warning?: string;
}

export interface UploadedAsset {
	/** File name as stored by Wiki.js, which may differ from the one sent. */
	fileName: string;
	/** Path of the asset on the wiki, starting with `/`, for use in Markdown links. */
	path: string;
}

export interface WikiClient {
	readonly version: WikiVersion;
	/** Checks that the server answers and accepts the token. Throws a WikiApiError otherwise. */
	checkConnection(): Promise<ConnectionInfo>;
	/** The page at `path` in the configured locale, or null if there is none. */
	getPageByPath(path: string): Promise<RemotePage | null>;
	createPage(input: PageInput): Promise<RemotePage>;
	/** Overwrites the page's content and metadata (Obsidian always wins). Doesn't move it. */
	updatePage(id: string, input: PageInput): Promise<RemotePage>;
	/** Creates the page, or overwrites it if one already exists at the same path: Obsidian always wins. */
	upsertPage(input: PageInput): Promise<RemotePage>;
	deletePage(id: string): Promise<void>;
	/** Moves a page to another path, keeping its history. The path must be free. */
	movePage(id: string, path: string): Promise<void>;
	/**
	 * Uploads a file into `folderPath` (created if missing, `''` for the root), overwriting any file
	 * with the same name. The folder path should go through `toWikiPath` and the name through
	 * `toAssetFileName` first.
	 */
	uploadAsset(folderPath: string, fileName: string, data: ArrayBuffer, mimeType: string): Promise<UploadedAsset>;
}
