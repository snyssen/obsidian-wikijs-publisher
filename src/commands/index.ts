import { Notice, TFile, TFolder } from 'obsidian';
import { PushReportModal, pushSummary } from '../ui/push-report';
import type WikiJsPublisherPlugin from '../main';
import { isPushable, pushFolder, pushMarkedNotes, pushNote } from './push';
import { excludeFolder, excludeNote, setFolderDestination, setNoteDestination } from './set-destination';
import { pushTestPage } from './push-test-page';
import { runConnectionTest } from './test-connection';

export function registerCommands(plugin: WikiJsPublisherPlugin): void {
	addNoteCommand(plugin, 'push-note', 'Push current note', 'upload-cloud', pushNote);
	addNoteCommand(plugin, 'set-destination', 'Set Wiki.js destination of current note', 'map-pin', setNoteDestination);
	addNoteCommand(plugin, 'exclude-note', 'Exclude current note from Wiki.js', 'eye-off', excludeNote);

	plugin.addCommand({
		id: 'push-marked-notes',
		name: 'Push notes marked for publishing',
		icon: 'upload-cloud',
		callback: () => void pushMarkedNotes(plugin),
	});

	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			const entries: [string, string, () => Promise<void>][] =
				file instanceof TFile && isPushable(file)
					? [
							['Push to Wiki.js', 'upload-cloud', () => pushNote(plugin, file)],
							['Set Wiki.js destination', 'map-pin', () => setNoteDestination(plugin, file)],
							['Exclude from Wiki.js', 'eye-off', () => excludeNote(plugin, file)],
						]
					: file instanceof TFolder
						? [
								['Push folder to Wiki.js', 'upload-cloud', () => pushFolder(plugin, file)],
								['Set Wiki.js destination', 'map-pin', () => setFolderDestination(plugin, file)],
								['Exclude from Wiki.js', 'eye-off', () => excludeFolder(plugin, file)],
							]
						: [];
			for (const [title, icon, action] of entries) {
				menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(() => void action()));
			}
		}),
	);

	plugin.addCommand({
		id: 'show-auto-push-report',
		name: 'Show last automatic push report',
		callback: () => {
			const results = plugin.autoPusher.lastResults;
			if (results.length === 0) new Notice('No automatic push has run yet.');
			else new PushReportModal(plugin.app, pushSummary(results), results).open();
		},
	});

	plugin.addCommand({
		id: 'test-connection',
		name: 'Test connection',
		callback: () => void runConnectionTest(plugin),
	});

	if (__DEV__) {
		plugin.addCommand({
			id: 'dev-push-test-page',
			name: 'Push test page (dev)',
			callback: () => void pushTestPage(plugin),
		});
	}
}

/** A command acting on the active note, only available when a Markdown note is active. */
function addNoteCommand(
	plugin: WikiJsPublisherPlugin,
	id: string,
	name: string,
	icon: string,
	action: (plugin: WikiJsPublisherPlugin, file: TFile) => Promise<void>,
): void {
	plugin.addCommand({
		id,
		name,
		icon,
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!isPushable(file)) return false;
			if (!checking) void action(plugin, file);
			return true;
		},
	});
}
