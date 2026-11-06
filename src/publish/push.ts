import { getFrontMatterInfo, parseYaml, TFile } from 'obsidian';
import { convertMarkdown, Dialect, dialectFor, LinkTarget, referencedLinkpaths } from '../convert';
import type WikiJsPublisherPlugin from '../main';
import { errorMessage } from '../ui/notices';
import { createClient } from '../wiki/factory';
import { obsidianHttp } from '../wiki/obsidian-http';
import { RemotePage, WikiClient } from '../wiki/types';
import { Note, toPageInput } from './note';
import { planErrors } from './plan';
import { setPublishProperty } from './property';
import { resolveLinks } from './resolve';

export interface PushItem {
	file: TFile;
	/** Wiki path of its page. */
	path: string;
	/** Problems found while working out the path (e.g. an invalid destination), reported with the result. */
	warnings?: string[];
}

export type PushResult = { file: TFile; warnings: string[] } & (
	| { page: RemotePage }
	| { error: string }
	/** Not pushed, on purpose (e.g. the user refused to overwrite a page). */
	| { skipped: string }
);

/** A page, not pushed by this note, standing where the note's page should go. */
export interface Collision {
	file: TFile;
	path: string;
	existing: RemotePage;
}

export type CollisionChoice = 'replace' | 'skip' | 'exclude';

export interface PushOptions {
	onProgress?: (done: number, item: PushItem) => void;
	/** Asks what to do about collisions. Without it, they are skipped. */
	resolveCollisions?: (collisions: Collision[]) => Promise<Map<TFile, CollisionChoice>>;
	/** Automatic push: collisions the user already refused to overwrite are skipped without asking again. */
	automatic?: boolean;
}

/** What pushing a note does on the wiki. */
interface Step {
	item: PushItem;
	/** The note's own page, wherever it is (to update, after moving it if needed). */
	own: RemotePage | null;
	/** Another page at the target path, deleted first (the user chose to replace it). */
	replace?: RemotePage;
}

/**
 * Pushes notes with one client. Pages are only overwritten when the push registry says the note pushed
 * them; a note's page that changed path is moved rather than duplicated. Links between the notes resolve
 * to their new pages, and attachments are uploaded once. A note that fails doesn't stop the others: its
 * error is in its result. Throws only if the wiki can't be reached at all.
 */
export async function pushNotes(plugin: WikiJsPublisherPlugin, items: PushItem[], options: PushOptions = {}): Promise<PushResult[]> {
	const config = plugin.getWikiConfig();
	const client = await createClient(obsidianHttp, config);
	const { registry, declinedOverwrites } = plugin;
	const results: PushResult[] = [];
	const done = (item: PushItem, result: { page: RemotePage } | { error: string } | { skipped: string }) =>
		results.push({ file: item.file, warnings: item.warnings ?? [], ...result });

	// 1. Plan what each note does, and find the pages in the way
	const errors = planErrors(items.map(({ file, path }) => ({ vaultPath: file.path, path })));
	const steps: Step[] = [];
	const collisions = new Map<TFile, { step: Step; collision: Collision }>();
	for (const item of items) {
		const planError = errors.get(item.file.path);
		if (planError !== undefined) {
			done(item, { error: planError });
			continue;
		}
		try {
			const registered = registry.get(config.url, item.file.path);
			const target = await client.getPageByPath(item.path);
			if (registered === item.path || target === null) {
				const own = registered === item.path ? target : registered === undefined ? null : await client.getPageByPath(registered);
				steps.push({ item, own });
			} else if (options.automatic && declinedOverwrites.get(config.url, item.file.path) === item.path) {
				done(item, { skipped: `you chose not to replace the page already at /${item.path}` });
			} else {
				const own = registered === undefined ? null : await client.getPageByPath(registered);
				collisions.set(item.file, { step: { item, own }, collision: { file: item.file, path: item.path, existing: target } });
			}
		} catch (error) {
			done(item, { error: errorMessage(error) });
		}
	}

	// 2. Ask about the collisions, all at once
	if (collisions.size > 0) {
		const choices = (await options.resolveCollisions?.([...collisions.values()].map(({ collision }) => collision))) ?? new Map<TFile, CollisionChoice>();
		for (const [file, { step, collision }] of collisions) {
			const choice = choices.get(file) ?? 'skip';
			if (choice === 'replace') {
				steps.push({ ...step, replace: collision.existing });
			} else if (choice === 'exclude') {
				await setPublishProperty(plugin, file, false);
				done(step.item, { skipped: 'excluded from publishing' });
			} else {
				await declinedOverwrites.set(config.url, file.path, collision.path);
				done(step.item, { skipped: `a page that wasn't pushed from this note is already at /${collision.path}` });
			}
		}
	}

	// 3. Push, in path order. Links between the notes go to their planned pages.
	steps.sort((a, b) => a.item.file.path.localeCompare(b.item.file.path));
	const planned = new Map(steps.map(({ item }) => [item.file.path, item.path]));
	const uploads = new Map<string, Promise<LinkTarget>>();
	const context: StepContext = {
		plugin,
		client,
		wikiUrl: config.url,
		dialect: dialectFor(client.version),
		resolve: (file, linkpaths) =>
			resolveLinks(file, linkpaths, {
				app: plugin.app,
				client,
				pagePathOf: (dest) => planned.get(dest.path) ?? registry.get(config.url, dest.path),
				attachmentFolder: plugin.settings.attachmentFolder,
				uploads,
			}),
	};
	for (const [index, step] of steps.entries()) {
		options.onProgress?.(index, step.item);
		try {
			done(step.item, { page: await pushStep(context, step) });
		} catch (error) {
			done(step.item, { error: errorMessage(error) });
		}
	}
	return results;
}

interface StepContext {
	plugin: WikiJsPublisherPlugin;
	client: WikiClient;
	wikiUrl: string;
	dialect: Dialect;
	resolve: (file: TFile, linkpaths: string[]) => Promise<Map<string, LinkTarget>>;
}

async function pushStep({ plugin, client, wikiUrl, dialect, resolve }: StepContext, { item, own, replace }: Step): Promise<RemotePage> {
	const { file, path } = item;
	if (replace) await client.deletePage(replace.id);
	if (own && own.path !== path) {
		await client.movePage(own.id, path);
		// Recorded straight away: the page is at its new path even if the update below fails
		await plugin.registry.set(wikiUrl, file.path, path);
	}

	const note = await readNote(plugin, file);
	const targets = await resolve(file, referencedLinkpaths(note.body));
	const converted = convertMarkdown(note.body, { dialect, resolve: (linkpath) => targets.get(linkpath) });
	const input = toPageInput({ ...note, body: converted.content, inlineTags: converted.tags }, path);
	const page = own ? await client.updatePage(own.id, input) : await client.createPage(input);

	await plugin.registry.set(wikiUrl, file.path, path);
	await plugin.declinedOverwrites.delete(wikiUrl, file.path);
	return page;
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
