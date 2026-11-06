import { TFile, TFolder } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { isPushable, pushFolder, pushMarkedNotes, pushNote } from './push';
import { pushTestPage } from './push-test-page';
import { runConnectionTest } from './test-connection';

export function registerCommands(plugin: WikiJsPublisherPlugin): void {
	plugin.addCommand({
		id: 'push-note',
		name: 'Push current note',
		icon: 'upload-cloud',
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!isPushable(file)) return false;
			if (!checking) void pushNote(plugin, file);
			return true;
		},
	});

	plugin.addCommand({
		id: 'push-marked-notes',
		name: 'Push notes marked for publishing',
		icon: 'upload-cloud',
		callback: () => void pushMarkedNotes(plugin),
	});

	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			if (file instanceof TFile && isPushable(file)) {
				menu.addItem((item) =>
					item
						.setTitle('Push to Wiki.js')
						.setIcon('upload-cloud')
						.onClick(() => void pushNote(plugin, file)),
				);
			} else if (file instanceof TFolder) {
				menu.addItem((item) =>
					item
						.setTitle('Push folder to Wiki.js')
						.setIcon('upload-cloud')
						.onClick(() => void pushFolder(plugin, file)),
				);
			}
		}),
	);

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
