import { TFile } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { parseDestination, PropertyDestination } from './destinations';
import { notePagePath } from './note';
import type { PushItem } from './push';

/** What the note's publishing property says, or undefined if the note doesn't have it. */
export function noteDestination(plugin: WikiJsPublisherPlugin, file: TFile): PropertyDestination | undefined {
	const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
	return parseDestination(frontmatter?.[plugin.settings.publishProperty]);
}

/** Push item for a note marked for publishing, at its own destination; undefined if not marked or excluded. */
export function markedItem(plugin: WikiJsPublisherPlugin, file: TFile): PushItem | undefined {
	const marked = noteDestination(plugin, file);
	if (!marked || marked.kind === 'excluded') return undefined;
	const destination = marked.kind === 'explicit' ? marked.destination : plugin.settings.defaultDestination;
	return { file, path: notePagePath(destination, file.basename), warnings: marked.warning ? [marked.warning] : [] };
}

/** Writes the publishing property, keeping the rest of the frontmatter. */
export async function setPublishProperty(plugin: WikiJsPublisherPlugin, file: TFile, value: string | false): Promise<void> {
	await plugin.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		frontmatter[plugin.settings.publishProperty] = value;
	});
}
