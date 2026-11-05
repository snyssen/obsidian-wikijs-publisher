import { App, TFile } from 'obsidian';
import { LinkTarget } from '../convert';
import { toAssetFileName, toWikiPath } from '../wiki/paths';
import { WikiClient } from '../wiki/types';
import { PushRegistry } from './registry';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);

const MIME_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	bmp: 'image/bmp',
	avif: 'image/avif',
	pdf: 'application/pdf',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	mp4: 'video/mp4',
	webm: 'video/webm',
	txt: 'text/plain',
	csv: 'text/csv',
	zip: 'application/zip',
};

export interface ResolveOptions {
	app: App;
	client: WikiClient;
	registry: PushRegistry;
	wikiUrl: string;
	/** The note being pushed, and the path its page gets. */
	file: TFile;
	pagePath: string;
	/** Wiki folder that attachments are uploaded under. */
	attachmentFolder: string;
}

/**
 * Resolves the link paths of a note to wiki targets, uploading the attachments it refers to.
 * Notes never pushed to this wiki are left out, so their links become plain text.
 */
export async function resolveLinks(linkpaths: string[], options: ResolveOptions): Promise<Map<string, LinkTarget>> {
	const { app, client, registry, wikiUrl, file, pagePath } = options;
	const targets = new Map<string, LinkTarget>();
	const uploads = new Map<string, Promise<LinkTarget>>();

	for (const linkpath of linkpaths) {
		const dest = findLinkedFile(app, linkpath, file);
		if (!dest) continue;
		if (dest.extension === 'md') {
			const path = dest === file ? pagePath : registry.get(wikiUrl, dest.path);
			if (path !== undefined) targets.set(linkpath, { kind: 'page', path });
			continue;
		}
		// The same file can be linked to with different link paths: upload it once
		let upload = uploads.get(dest.path);
		if (!upload) {
			upload = uploadAttachment(app, client, dest, options.attachmentFolder);
			uploads.set(dest.path, upload);
		}
		targets.set(linkpath, await upload);
	}
	return targets;
}

/**
 * The file a link path points to, as Obsidian finds it. Paths relative to the note (`./x.png`, `../x.md`)
 * are resolved too; if nothing is there, the name alone is looked up, like Obsidian does for wikilinks.
 */
function findLinkedFile(app: App, linkpath: string, source: TFile): TFile | null {
	const found = app.metadataCache.getFirstLinkpathDest(linkpath, source.path);
	if (found || !/^\.\.?\//.test(linkpath)) return found;

	const segments: string[] = [];
	for (const segment of `${source.parent?.path ?? ''}/${linkpath}`.split('/')) {
		if (segment === '..') segments.pop();
		else if (segment !== '.' && segment !== '') segments.push(segment);
	}
	const relative = app.vault.getFileByPath(segments.join('/'));
	return relative ?? app.metadataCache.getFirstLinkpathDest(segments[segments.length - 1] ?? '', source.path);
}

/** Uploads a vault file to `<attachment folder>/<its vault folder>/`, so same-named files don't clash. */
async function uploadAttachment(app: App, client: WikiClient, file: TFile, attachmentFolder: string): Promise<LinkTarget> {
	const extension = file.extension.toLowerCase();
	const folder = toWikiPath(`${attachmentFolder}/${file.parent?.path ?? ''}`);
	try {
		const asset = await client.uploadAsset(
			folder,
			toAssetFileName(file.name),
			await app.vault.readBinary(file),
			MIME_TYPES[extension] ?? 'application/octet-stream',
		);
		return { kind: 'file', url: asset.path, image: IMAGE_EXTENSIONS.has(extension) };
	} catch (error) {
		throw new Error(`could not upload ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
