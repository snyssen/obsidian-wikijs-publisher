import { Notice, TAbstractFile, TFile, TFolder, Vault } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { formatDestination, movedDestination } from './destinations';
import { noteDestination, setPublishProperty } from './property';

/** How long to wait for the other notes of a folder move before updating them all. */
const BATCH_DELAY = 500;

/**
 * Keeps destinations in step with moves: when a note with an explicit destination moves to another
 * folder, the destination follows if it can be inferred (see `movedDestination`). Moves are batched, so
 * moving a folder gives one notice.
 */
export class DestinationFollower {
	/** Old path of each moved note, by note. */
	private readonly moved = new Map<TFile, string>();
	private timer: number | undefined;

	constructor(private readonly plugin: WikiJsPublisherPlugin) {}

	onRename(file: TAbstractFile, oldPath: string): void {
		if (!this.plugin.settings.followMoves) return;
		if (file instanceof TFolder) {
			// Each note of a moved folder, whether or not Obsidian also reports them one by one
			Vault.recurseChildren(file, (child) => {
				if (child instanceof TFile) this.add(child, oldPath + child.path.slice(file.path.length));
			});
		} else if (file instanceof TFile) {
			this.add(file, oldPath);
		}
	}

	unload(): void {
		window.clearTimeout(this.timer);
	}

	private add(file: TFile, oldPath: string): void {
		if (file.extension !== 'md' || parentOf(oldPath) === (file.parent?.path ?? '')) return;
		if (!this.moved.has(file)) this.moved.set(file, oldPath);
		window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => void this.update(), BATCH_DELAY);
	}

	private async update(): Promise<void> {
		const moved = [...this.moved];
		this.moved.clear();
		const updated: string[] = [];
		const leftAsIs: string[] = [];
		for (const [file, oldPath] of moved) {
			const current = noteDestination(this.plugin, file);
			if (current?.kind !== 'explicit') continue;
			const value = formatDestination(current.destination);
			const next = movedDestination(value, parentOf(oldPath), file.parent?.path ?? '');
			if (next === undefined) {
				leftAsIs.push(file.basename);
			} else if (next !== value) {
				await setPublishProperty(this.plugin, file, next);
				updated.push(file.basename);
			}
		}
		if (updated.length === 0 && leftAsIs.length === 0) return;

		const parts: string[] = [];
		if (updated.length > 0) parts.push(`Wiki.js destination updated: ${list(updated)}.`);
		if (leftAsIs.length > 0) parts.push(`Destination left as is (it doesn't follow the folders): ${list(leftAsIs)}.`);
		new Notice(parts.join(' '), 10000);
	}
}

function parentOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

function list(names: string[]): string {
	return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}
