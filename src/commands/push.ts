import { Notice, TFile, TFolder, Vault } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { formatDestination } from '../publish/destinations';
import { notePagePath, vaultPagePath } from '../publish/note';
import { markedItem, noteDestination } from '../publish/property';
import { PushItem, pushNotes } from '../publish/push';
import { askCollisions } from '../ui/collisions-modal';
import { confirm } from '../ui/confirm-modal';
import { askDestination } from '../ui/destination-modal';
import { errorMessage } from '../ui/notices';
import { showPushReport } from '../ui/push-report';

export function isPushable(file: TFile | null): file is TFile {
	return file?.extension === 'md';
}

/** Markdown notes in a folder and its subfolders. */
export function notesIn(folder: TFolder): TFile[] {
	const files: TFile[] = [];
	Vault.recurseChildren(folder, (child) => {
		if (child instanceof TFile && isPushable(child)) files.push(child);
	});
	return files;
}

/** Pushes one note to `<destination>/<note name>`; the note's own destination is offered first. */
export async function pushNote(plugin: WikiJsPublisherPlugin, file: TFile): Promise<void> {
	const own = noteDestination(plugin, file);
	const destination = await askAndRemember(plugin, {
		title: 'Push to Wiki.js',
		initial: own?.kind === 'explicit' ? formatDestination(own.destination) : undefined,
		describe: (destination) => {
			const path = notePagePath(destination, file.basename);
			return path === '' ? { error: 'This note has no letters or digits to name the page with' } : { preview: `Page: /${path}` };
		},
	});
	if (destination !== null) await runPush(plugin, [{ file, path: notePagePath(destination, file.basename) }]);
}

/**
 * Pushes the notes of a folder, keeping their folders: `<destination>/<folder path>/<note path>`.
 * Notes set to `false` are left out.
 */
export async function pushFolder(plugin: WikiJsPublisherPlugin, folder: TFolder): Promise<void> {
	const files = notesIn(folder).filter((file) => noteDestination(plugin, file)?.kind !== 'excluded');
	if (files.length === 0) {
		new Notice(`${folder.name} has no notes to push.`);
		return;
	}
	const destination = await askAndRemember(plugin, {
		title: `Push ${folder.name} to Wiki.js`,
		describe: (destination) => ({ preview: `${count(files.length)} under ${wikiFolder(vaultPagePath(destination, folder.path))}` }),
	});
	if (destination !== null) await runPush(plugin, files.map((file) => ({ file, path: vaultPagePath(destination, file.path) })));
}

/** Pushes every note marked with the publishing property, each to its own destination. */
export async function pushMarkedNotes(plugin: WikiJsPublisherPlugin): Promise<void> {
	const items = plugin.app.vault
		.getMarkdownFiles()
		.flatMap((file) => markedItem(plugin, file) ?? [])
		.sort((a, b) => a.file.path.localeCompare(b.file.path));
	if (items.length === 0) {
		new Notice(`No notes are marked with the ${plugin.settings.publishProperty} property.`);
		return;
	}
	const examples = items.slice(0, 5).map(({ file, path }) => `${file.path} → /${path}`);
	if (items.length > examples.length) examples.push(`… and ${items.length - examples.length} more`);
	const confirmed = await confirm(plugin.app, {
		title: 'Push notes marked for publishing',
		message: [`${count(items.length)} will be pushed, each to its destination:`],
		list: examples,
		cta: 'Push',
	});
	if (confirmed) await runPush(plugin, items);
}


/** Pushes with progress in a notice, asking about collisions, then reports. */
export async function runPush(plugin: WikiJsPublisherPlugin, items: PushItem[]): Promise<void> {
	const progress = new Notice(items.length === 1 ? `Pushing ${items[0]!.file.basename}…` : `Pushing ${count(items.length)}…`, 0);
	try {
		const results = await pushNotes(plugin, items, {
			onProgress: (done, item) => {
				if (items.length > 1) progress.setMessage(`Pushing ${done + 1}/${items.length}: ${item.file.basename}…`);
			},
			resolveCollisions: (collisions) => askCollisions(plugin.app, collisions),
		});
		showPushReport(plugin.app, results);
	} catch (error) {
		new Notice(`Could not push: ${errorMessage(error)}`, 10000);
	} finally {
		progress.hide();
	}
}

interface AskOptions {
	title: string;
	/** Prefilled destination; the last used one (or the default one) otherwise. */
	initial?: string;
	describe: (destination: string) => { preview: string } | { error: string };
}

/** Asks for a destination, and remembers it for next time. */
async function askAndRemember(plugin: WikiJsPublisherPlugin, options: AskOptions): Promise<string | null> {
	const { settings } = plugin;
	const destination = await askDestination(plugin.app, {
		...options,
		initial: options.initial ?? settings.lastDestination ?? settings.defaultDestination,
	});
	if (destination === null) return null;
	settings.lastDestination = destination;
	await plugin.saveSettings();
	return destination;
}

/** A wiki folder for display: `/some/path/`, or `/` for the root. */
export function wikiFolder(path: string): string {
	return path === '' ? '/' : `/${path}/`;
}

export function count(notes: number): string {
	return notes === 1 ? '1 note' : `${notes} notes`;
}
