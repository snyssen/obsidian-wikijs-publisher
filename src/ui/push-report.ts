import { App, Modal, Notice } from 'obsidian';
import type { PushResult } from '../publish/push';
import { showPushedNotice } from './notices';

/** Tells how a push went: a notice when everything worked, the list of failures otherwise. */
export function showPushReport(app: App, results: PushResult[]): void {
	const failures = results.filter((result) => 'error' in result);
	if (results.length === 1) {
		const [result] = results as [PushResult];
		if ('page' in result) showPushedNotice(`${result.file.basename} pushed`, result.page);
		else new Notice(`Could not push ${result.file.basename}: ${result.error}`, 10000);
		return;
	}
	if (failures.length === 0) {
		new Notice(`${results.length} notes pushed.`);
		return;
	}
	new PushReportModal(app, results.length - failures.length, failures).open();
}

class PushReportModal extends Modal {
	constructor(
		app: App,
		private readonly pushed: number,
		private readonly failures: PushResult[],
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Push finished with errors');
		const notes = (count: number) => (count === 1 ? '1 note' : `${count} notes`);
		this.contentEl.createEl('p', { text: `${notes(this.pushed)} pushed, ${notes(this.failures.length)} failed:` });
		const list = this.contentEl.createEl('ul');
		for (const result of this.failures) {
			const item = list.createEl('li');
			item.createEl('strong', { text: result.file.path });
			if ('error' in result) item.appendText(`: ${result.error}`);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
