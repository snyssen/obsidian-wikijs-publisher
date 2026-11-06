import { getFrontMatterInfo, parseYaml, TFile } from 'obsidian';
import { convertMarkdown, dialectFor, LinkTarget, referencedLinkpaths } from '../convert';
import type WikiJsPublisherPlugin from '../main';
import { errorMessage } from '../ui/notices';
import { createClient } from '../wiki/factory';
import { obsidianHttp } from '../wiki/obsidian-http';
import { RemotePage } from '../wiki/types';
import { Note, toPageInput } from './note';
import { planErrors } from './plan';
import { resolveLinks } from './resolve';

export interface PushItem {
	file: TFile;
	/** Wiki path of its page. */
	path: string;
}

export type PushResult = { file: TFile; page: RemotePage } | { file: TFile; error: string };

/**
 * Pushes notes one after the other with one client. Links between them resolve to their new pages, and
 * attachments are uploaded once. A note that fails doesn't stop the others: its error is in its result.
 * Throws only if the wiki can't be reached at all.
 */
export async function pushNotes(
	plugin: WikiJsPublisherPlugin,
	items: PushItem[],
	onProgress?: (done: number, item: PushItem) => void,
): Promise<PushResult[]> {
	const config = plugin.getWikiConfig();
	const client = await createClient(obsidianHttp, config);
	const dialect = dialectFor(client.version);
	const errors = planErrors(items.map(({ file, path }) => ({ vaultPath: file.path, path })));
	const planned = new Map(items.filter(({ file }) => !errors.has(file.path)).map(({ file, path }) => [file.path, path]));
	const uploads = new Map<string, Promise<LinkTarget>>();

	const results: PushResult[] = [];
	for (const [index, item] of items.entries()) {
		onProgress?.(index, item);
		const { file, path } = item;
		const planError = errors.get(file.path);
		if (planError !== undefined) {
			results.push({ file, error: planError });
			continue;
		}
		try {
			const note = await readNote(plugin, file);
			const targets = await resolveLinks(file, referencedLinkpaths(note.body), {
				app: plugin.app,
				client,
				pagePathOf: (dest) => planned.get(dest.path) ?? plugin.registry.get(config.url, dest.path),
				attachmentFolder: plugin.settings.attachmentFolder,
				uploads,
			});
			const converted = convertMarkdown(note.body, { dialect, resolve: (linkpath) => targets.get(linkpath) });
			const page = await client.upsertPage(toPageInput({ ...note, body: converted.content, inlineTags: converted.tags }, path));
			await plugin.registry.set(config.url, file.path, path);
			results.push({ file, page });
		} catch (error) {
			results.push({ file, error: errorMessage(error) });
		}
	}
	return results;
}

async function readNote(plugin: WikiJsPublisherPlugin, file: TFile): Promise<Note> {
	// Parsed from the content just read rather than the metadata cache, which can lag behind recent edits
	const content = await plugin.app.vault.read(file);
	const info = getFrontMatterInfo(content);
	let frontmatter: unknown;
	if (info.exists) {
		try {
			frontmatter = parseYaml(info.frontmatter);
		} catch (error) {
			throw new Error(`its frontmatter is not valid YAML (${errorMessage(error)})`);
		}
	}
	return { basename: file.basename, frontmatter, body: content.slice(info.contentStart) };
}
