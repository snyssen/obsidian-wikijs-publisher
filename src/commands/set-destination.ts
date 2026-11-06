import { Notice, TFile, TFolder } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { folderDestination, formatDestination } from '../publish/destinations';
import { notePagePath } from '../publish/note';
import { noteDestination, setPublishProperty } from '../publish/property';
import { confirm } from '../ui/confirm-modal';
import { askDestination } from '../ui/destination-modal';
import { count, notesIn } from './push';

/** Writes a destination in the publishing property of a note. */
export async function setNoteDestination(plugin: WikiJsPublisherPlugin, file: TFile): Promise<void> {
	const current = noteDestination(plugin, file);
	if (current?.kind === 'excluded') {
		const confirmed = await confirm(plugin.app, {
			title: 'Publish an excluded note?',
			message: [`${file.basename} is excluded from publishing. Setting a destination will include it again.`],
			cta: 'Continue',
		});
		if (!confirmed) return;
	}
	const destination = await askDestination(plugin.app, {
		title: `Wiki.js destination of ${file.basename}`,
		initial: current?.kind === 'explicit' ? formatDestination(current.destination) : plugin.settings.defaultDestination,
		describe: (destination) => {
			const path = notePagePath(destination, file.basename);
			return path === '' ? { error: 'This note has no letters or digits to name the page with' } : { preview: `Page: /${path}` };
		},
		cta: 'Set',
	});
	if (destination === null) return;
	const value = formatDestination(destination);
	await setPublishProperty(plugin, file, value);
	new Notice(`${file.basename} will be published under ${value}.`);
}

/**
 * Writes destinations in the publishing property of the notes of a folder: the destination, then each
 * note's folders below this one. Notes set to `false` are left alone.
 */
export async function setFolderDestination(plugin: WikiJsPublisherPlugin, folder: TFolder): Promise<void> {
	const notes = notesIn(folder);
	const state = { onlyMarked: false };
	const targets = () =>
		notes.filter((file) => {
			const current = noteDestination(plugin, file);
			return current?.kind !== 'excluded' && (!state.onlyMarked || current !== undefined);
		});

	const destination = await askDestination(plugin.app, {
		title: `Wiki.js destination of ${folder.name}`,
		initial: plugin.settings.defaultDestination,
		describe: (destination) => {
			const files = targets();
			if (files.length === 0) return { error: 'No notes to update' };
			const examples = files.slice(0, 2).map((file) => `${file.name} → ${folderDestination(folder.path, file.path, destination)}`);
			return { preview: `${count(files.length)}, e.g. ${examples.join(', ')}` };
		},
		toggle: {
			name: 'Only notes that already have the property',
			desc: 'Leave the notes without it unpublished.',
			value: false,
			onChange: (value) => (state.onlyMarked = value),
		},
		cta: 'Set',
	});
	if (destination === null) return;

	const files = targets();
	for (const file of files) await setPublishProperty(plugin, file, folderDestination(folder.path, file.path, destination));
	const skipped = notes.length - files.length;
	new Notice(`Destination set on ${count(files.length)}${skipped > 0 ? ` (${skipped} left as is)` : ''}.`);
}

/** Excludes a note from publishing: `false` in its publishing property. */
export async function excludeNote(plugin: WikiJsPublisherPlugin, file: TFile): Promise<void> {
	await setPublishProperty(plugin, file, false);
	new Notice(`${file.basename} is excluded from publishing.`);
}

/** Excludes every note of a folder from publishing, after a confirmation. */
export async function excludeFolder(plugin: WikiJsPublisherPlugin, folder: TFolder): Promise<void> {
	const notes = notesIn(folder);
	if (notes.length === 0) {
		new Notice(`${folder.name} has no notes.`);
		return;
	}
	const confirmed = await confirm(plugin.app, {
		title: `Exclude ${folder.name} from Wiki.js?`,
		message: [
			`${count(notes.length)} will be set to "${plugin.settings.publishProperty}: false" and never pushed, not even automatically.`,
			'Pages already on the wiki are left as they are.',
		],
		cta: 'Exclude',
	});
	if (!confirmed) return;
	for (const file of notes) await setPublishProperty(plugin, file, false);
	new Notice(`${count(notes.length)} excluded from publishing.`);
}
