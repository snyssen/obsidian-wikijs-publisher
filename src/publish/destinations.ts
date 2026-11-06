// Destinations held by the publishing property (no Obsidian import)
import { slugify, toWikiPath } from '../wiki/paths';

/**
 * What a note's publishing property says:
 * - `false` (or `"false"`): excluded, never pushed;
 * - a value starting with `/`: its own destination;
 * - `true`, empty, or anything else: the default destination.
 * A property that is absent means the note isn't marked at all (`undefined`).
 */
export type PropertyDestination =
	| { kind: 'excluded' }
	| { kind: 'explicit'; destination: string; warning?: string }
	| { kind: 'default'; warning?: string };

export function parseDestination(value: unknown): PropertyDestination | undefined {
	if (value === undefined) return undefined;
	if (value === false || (typeof value === 'string' && value.trim().toLowerCase() === 'false')) return { kind: 'excluded' };
	if (typeof value !== 'string' || value.trim() === '') return { kind: 'default' };

	const raw = value.trim();
	if (!raw.startsWith('/')) {
		return { kind: 'default', warning: `"${raw}" doesn't start with /, so the default destination was used` };
	}
	const destination = toWikiPath(raw);
	// Hand-written values may not be valid wiki paths: say what was used instead
	const changed = formatDestination(destination) !== raw.replace(/(.)\/+$/, '$1');
	return changed
		? { kind: 'explicit', destination, warning: `"${raw}" is not a valid wiki path, ${formatDestination(destination)} was used` }
		: { kind: 'explicit', destination };
}

/** Destination as written in the property: `/some/path`, or `/` for the wiki root. */
export function formatDestination(destination: string): string {
	return `/${toWikiPath(destination)}`;
}

/**
 * Property values for the notes of a folder pushed to `destination`: the destination, then the note's
 * folders below the folder (the folder's own name is not part of it).
 * `Events` → `/campaign`: `Events/Events.md` gets `/campaign`, `Events/Partie 0/x.md` gets `/campaign/partie-0`.
 */
export function folderDestination(folderPath: string, notePath: string, destination: string): string {
	const parent = notePath.split('/').slice(0, -1).join('/');
	const below = folderPath === '' || folderPath === '/' ? parent : parent.slice(folderPath.length + 1);
	return formatDestination(`${destination}/${below}`);
}

/**
 * New property value for a note moved from folder `oldParent` to `newParent`, or undefined when it can't
 * be inferred. The value is taken to be a destination followed by the slugified folders below some
 * ancestor of the old folder (as `folderDestination` writes it): the move then swaps those folders, as
 * long as the note stays below that ancestor. `/campaign/partie-0` in `Events/Partie 0`, moved to
 * `Events/Partie 1`, becomes `/campaign/partie-1`.
 */
export function movedDestination(value: string, oldParent: string, newParent: string): string | undefined {
	const segments = (path: string) => path.split('/').filter((segment) => segment !== '');
	const valueSegments = segments(toWikiPath(value));
	const oldFolders = segments(oldParent);
	const newFolders = segments(newParent);

	// The ancestor whose subfolders make up the end of the value: the longest match wins
	for (let anchor = 0; anchor <= oldFolders.length; anchor++) {
		const below = oldFolders.slice(anchor).map(slugify).filter((slug) => slug !== '');
		if (below.length > valueSegments.length) continue;
		if (below.some((slug, i) => valueSegments[valueSegments.length - below.length + i] !== slug)) continue;

		const ancestor = oldFolders.slice(0, anchor);
		if (ancestor.some((folder, i) => newFolders[i] !== folder)) return undefined;
		const root = valueSegments.slice(0, valueSegments.length - below.length);
		return formatDestination([...root, ...newFolders.slice(anchor)].join('/'));
	}
	return undefined;
}
