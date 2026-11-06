import { App, Modal, Notice } from 'obsidian';
import type { PushResult } from '../publish/push';
import { showPushedNotice } from './notices';

/**
 * Tells how a push went: a notice when everything worked, otherwise a modal listing the failed and
 * skipped notes and the warnings, each with its note.
 */
export function showPushReport(app: App, results: PushResult[]): void {
	if (results.length === 1) {
		const [result] = results as [PushResult];
		const warnings = result.warnings.length > 0 ? ` (${result.warnings.join('; ')})` : '';
		if ('page' in result) {
			showPushedNotice(`${result.file.basename} pushed${warnings}`, result.page);
		} else if ('error' in result) {
			new Notice(`Could not push ${result.file.basename}: ${result.error}${warnings}`, 10000);
		} else {
			new Notice(`${result.file.basename} not pushed: ${result.skipped}`, 10000);
		}
		return;
	}
	const summary = pushSummary(results);
	if (!needsReport(results)) {
		new Notice(summary);
		return;
	}
	new PushReportModal(app, summary, results).open();
}

/** Whether a push has anything to look at beyond the count of pushed notes. */
export function needsReport(results: PushResult[]): boolean {
	return results.some((result) => !('page' in result) || result.warnings.length > 0);
}

/** `12 notes pushed, 1 failed, 2 skipped.` */
export function pushSummary(results: PushResult[]): string {
	const pushed = results.filter((result) => 'page' in result).length;
	const failed = results.filter((result) => 'error' in result).length;
	const skipped = results.filter((result) => 'skipped' in result).length;
	const parts = [`${pushed === 1 ? '1 note' : `${pushed} notes`} pushed`];
	if (failed > 0) parts.push(`${failed} failed`);
	if (skipped > 0) parts.push(`${skipped} skipped`);
	return `${parts.join(', ')}.`;
}

export class PushReportModal extends Modal {
	constructor(
		app: App,
		private readonly summary: string,
		private readonly results: PushResult[],
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Push report');
		this.contentEl.createEl('p', { text: this.summary });
		this.section('Failed', this.results.flatMap((result) => ('error' in result ? [[result.file.path, result.error]] : [])));
		this.section('Skipped', this.results.flatMap((result) => ('skipped' in result ? [[result.file.path, result.skipped]] : [])));
		this.section(
			'Warnings',
			this.results.flatMap((result) => result.warnings.map((warning) => [result.file.path, warning])),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private section(heading: string, entries: string[][]): void {
		if (entries.length === 0) return;
		this.contentEl.createEl('h3', { text: heading });
		const list = this.contentEl.createEl('ul');
		for (const [path, message] of entries) {
			const item = list.createEl('li');
			item.createEl('strong', { text: path });
			item.appendText(`: ${message}`);
		}
	}
}
