import { ConnectionInfo, PageInput, RemotePage, UploadedAsset, WikiClient, WikiVersion } from './types';

/** Behaviour shared by every Wiki.js version, built on the version-specific methods. */
export abstract class BaseWikiClient implements WikiClient {
	abstract readonly version: WikiVersion;

	abstract checkConnection(): Promise<ConnectionInfo>;
	abstract getPageByPath(path: string): Promise<RemotePage | null>;
	abstract createPage(input: PageInput): Promise<RemotePage>;
	abstract updatePage(id: string, input: PageInput): Promise<RemotePage>;
	abstract deletePage(id: string): Promise<void>;
	abstract uploadAsset(folderPath: string, fileName: string, data: ArrayBuffer, mimeType: string): Promise<UploadedAsset>;

	async upsertPage(input: PageInput): Promise<RemotePage> {
		const existing = await this.getPageByPath(input.path);
		return existing ? this.updatePage(existing.id, input) : this.createPage(input);
	}
}
