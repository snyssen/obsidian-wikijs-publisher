import { App, TFile } from 'obsidian';
import { LinkTarget } from '../convert';
import { toAssetFileName, toWikiPath } from '../wiki/paths';
import { WikiClient } from '../wiki/types';

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
	/** Wiki path of a note's page: being pushed, or pushed before. Undefined if it isn't on the wiki. */
	pagePathOf(file: TFile): string | undefined;
	/** Wiki folder that attachments are uploaded under. */
	attachmentFolder: string;
	/** Uploads by vault path, shared by the notes of a push so each file is uploaded once. */
	uploads: Map<string, Promise<LinkTarget>>;
}

/**
 * Resolves the link paths of a note to wiki targets, uploading the attachments it refers to.
 * Notes not on the wiki are left out, so their links are marked as broken.
 */
export async function resolveLinks(source: TFile, linkpaths: string[], options: ResolveOptions): Promise<Map<string, LinkTarget>> {
	const { app, client, uploads } = options;
	const targets = new Map<string, LinkTarget>();

	for (const linkpath of linkpaths) {
		const dest = findLinkedFile(app, linkpath, source);
		if (!dest) continue;
		if (dest.extension === 'md') {
			const path = options.pagePathOf(dest);
			if (path !== undefined) targets.set(linkpath, { kind: 'page', path });
			continue;
		}
		// The same file can be linked to from several notes, or with different link paths: upload it once
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
