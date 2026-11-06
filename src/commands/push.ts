import { Notice, TFile, TFolder, Vault } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { notePagePath, vaultPagePath } from '../publish/note';
import { isMarkedForPublishing } from '../publish/plan';
import { pushNotes } from '../publish/push';
import { askDestination } from '../ui/destination-modal';
import { errorMessage } from '../ui/notices';
import { showPushReport } from '../ui/push-report';

export function isPushable(file: TFile | null): file is TFile {
	return file?.extension === 'md';
}

/** Pushes one note to `<destination>/<note name>`. */
export async function pushNote(plugin: WikiJsPublisherPlugin, file: TFile): Promise<void> {
	await pushWithDestination(plugin, {
		title: 'Push to Wiki.js',
		files: [file],
		pathFor: (destination) => notePagePath(destination, file.basename),
		describe: (destination) => {
			const path = notePagePath(destination, file.basename);
			return path === '' ? { error: 'This note has no letters or digits to name the page with' } : { preview: `Page: /${path}` };
		},
	});
}

/** Pushes the notes of a folder, keeping their folders: `<destination>/<folder path>/<note path>`. */
export async function pushFolder(plugin: WikiJsPublisherPlugin, folder: TFolder): Promise<void> {
	const files: TFile[] = [];
	Vault.recurseChildren(folder, (child) => {
		if (child instanceof TFile && isPushable(child)) files.push(child);
	});
	if (files.length === 0) {
		new Notice(`${folder.name} has no notes to push.`);
		return;
	}
	await pushWithDestination(plugin, {
		title: `Push ${folder.name} to Wiki.js`,
		files,
		pathFor: (destination, file) => vaultPagePath(destination, file.path),
		describe: (destination) => ({ preview: `${count(files.length)} under ${wikiFolder(vaultPagePath(destination, folder.path))}` }),
	});
}

/** Pushes the notes marked with the publishing property, keeping their vault folders. */
export async function pushMarkedNotes(plugin: WikiJsPublisherPlugin): Promise<void> {
	const property = plugin.settings.publishProperty;
	const files = plugin.app.vault
		.getMarkdownFiles()
		.filter((file) => isMarkedForPublishing(plugin.app.metadataCache.getFileCache(file)?.frontmatter?.[property]));
	if (files.length === 0) {
		new Notice(`No notes have the ${property} property.`);
		return;
	}
	await pushWithDestination(plugin, {
		title: `Push notes marked with ${property}`,
		files,
		pathFor: (destination, file) => vaultPagePath(destination, file.path),
		describe: (destination) => {
			return { preview: `${count(files.length)} under ${wikiFolder(vaultPagePath(destination, ''))}, in their vault folders` };
		},
	});
}

interface PushOptions {
	title: string;
	files: TFile[];
	/** Wiki path of a note's page for a destination. */
	pathFor: (destination: string, file: TFile) => string;
	describe: (destination: string) => { preview: string } | { error: string };
}

/** Asks for a destination (remembered for next time), pushes, then reports. */
async function pushWithDestination(plugin: WikiJsPublisherPlugin, options: PushOptions): Promise<void> {
	const { settings } = plugin;
	const destination = await askDestination(plugin.app, {
		title: options.title,
		initial: settings.lastDestination ?? settings.defaultDestination,
		describe: options.describe,
	});
	if (destination === null) return;
	settings.lastDestination = destination;
	await plugin.saveSettings();

	const files = [...options.files].sort((a, b) => a.path.localeCompare(b.path));
	const items = files.map((file) => ({ file, path: options.pathFor(destination, file) }));
	const progress = new Notice(items.length === 1 ? `Pushing ${files[0]!.basename}…` : `Pushing ${count(items.length)}…`, 0);
	try {
		const results = await pushNotes(plugin, items, (done, item) => {
			if (items.length > 1) progress.setMessage(`Pushing ${done + 1}/${items.length}: ${item.file.basename}…`);
		});
		showPushReport(plugin.app, results);
	} catch (error) {
		new Notice(`Could not push: ${errorMessage(error)}`, 10000);
	} finally {
		progress.hide();
	}
}

/** A wiki folder for display: `/some/path/`, or `/` for the root. */
function wikiFolder(path: string): string {
	return path === '' ? '/' : `/${path}/`;
}

function count(notes: number): string {
	return notes === 1 ? '1 note' : `${notes} notes`;
}
