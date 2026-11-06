import { Notice, Platform, TFile } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { askCollisions } from '../ui/collisions-modal';
import { errorMessage } from '../ui/notices';
import { pushSummary } from '../ui/push-report';
import { markedItem } from './property';
import { PushItem, pushNotes, PushResult } from './push';

/**
 * Pushes marked notes automatically after they change. Changes are queued and pushed together once
 * nothing has changed for the configured delay; one run at a time. The queue is saved, so notes changed
 * just before the app was closed or suspended (mobile) are pushed at the next start.
 */
export class AutoPusher {
	private readonly queue: Set<string>;
	private timer: number | undefined;
	private running = false;
	private readonly status: HTMLElement | undefined;
	/** Error of the last run that couldn't reach the wiki, so it's only shown once. */
	private lastError: string | undefined;
	/** Results of the last run, for the "Show last automatic push report" command. */
	lastResults: PushResult[] = [];

	constructor(private readonly plugin: WikiJsPublisherPlugin) {
		this.queue = new Set(plugin.settings.autoPushQueue ?? []);
		// The status bar only exists on desktop
		this.status = Platform.isDesktop ? plugin.addStatusBarItem() : undefined;
	}

	/** Resumes a queue left by a previous session. To call once the layout is ready. */
	start(): void {
		if (this.queue.size > 0) this.schedule();
	}

	unload(): void {
		window.clearTimeout(this.timer);
	}

	/** Queues a changed note, if automatic push is on and the note is marked for publishing. */
	onChange(file: TFile): void {
		if (!this.plugin.settings.autoPush || !markedItem(this.plugin, file)) return;
		this.queue.add(file.path);
		void this.saveQueue();
		this.schedule();
	}

	/** Follows a renamed or moved note in the queue. */
	onRename(file: TFile, oldPath: string): void {
		if (this.queue.delete(oldPath)) this.queue.add(file.path);
		this.onChange(file);
	}

	private schedule(): void {
		window.clearTimeout(this.timer);
		// One timer for every note: each change pushes the run back, so notes edited together go together
		this.timer = window.setTimeout(() => void this.run(), Math.max(1, this.plugin.settings.autoPushDelay) * 1000);
	}

	private async run(): Promise<void> {
		if (this.running) return; // The running push reschedules when it's done
		if (!this.plugin.settings.autoPush || this.queue.size === 0) return;
		this.running = true;
		const paths = [...this.queue];
		this.queue.clear();
		await this.saveQueue();
		this.setStatus('pushing…');

		try {
			const items = this.withBacklinks(
				paths.flatMap((path) => {
					const file = this.plugin.app.vault.getFileByPath(path);
					return file ? (markedItem(this.plugin, file) ?? []) : [];
				}),
			);
			const results = await pushNotes(this.plugin, items, {
				automatic: true,
				resolveCollisions: (collisions) => askCollisions(this.plugin.app, collisions),
			});
			this.lastResults = results;
			this.lastError = undefined;
			this.report(results);
		} catch (error) {
			// The wiki couldn't be reached: put the notes back, and say so once
			for (const path of paths) this.queue.add(path);
			await this.saveQueue();
			const message = errorMessage(error);
			this.setStatus('not connected');
			if (message !== this.lastError) new Notice(`Automatic push to Wiki.js failed: ${message}`, 10000);
			this.lastError = message;
		} finally {
			this.running = false;
			if (this.queue.size > 0 && this.lastError === undefined) this.schedule();
		}
	}

	/**
	 * Adds, for each note pushed for the first time, the marked notes linking to it that are already on the
	 * wiki: they were pushed with a broken link to it, which this run turns into a real link.
	 */
	private withBacklinks(items: PushItem[]): PushItem[] {
		const { app, registry } = this.plugin;
		const wikiUrl = this.plugin.settings.wikiUrl;
		const all = new Map(items.map((item) => [item.file.path, item]));
		const firstPushes = items.filter((item) => registry.get(wikiUrl, item.file.path) === undefined).map((item) => item.file.path);
		if (firstPushes.length === 0) return items;

		for (const [source, links] of Object.entries(app.metadataCache.resolvedLinks)) {
			if (all.has(source) || registry.get(wikiUrl, source) === undefined) continue;
			if (!firstPushes.some((path) => links[path] !== undefined)) continue;
			const file = app.vault.getFileByPath(source);
			const item = file && markedItem(this.plugin, file);
			if (item) all.set(source, item);
		}
		return [...all.values()];
	}

	private report(results: PushResult[]): void {
		const failed = results.filter((result) => 'error' in result).length;
		this.setStatus(failed > 0 ? `${failed} failed` : `pushed at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
		// Silent when everything worked (remembered refusals included); one notice otherwise
		if (results.some((result) => 'error' in result || result.warnings.length > 0)) {
			new Notice(`Automatic push to Wiki.js: ${pushSummary(results)} Run "Show last automatic push report" for details.`, 10000);
		}
	}

	private setStatus(text: string): void {
		this.status?.setText(`Wiki.js: ${text}`);
	}

	private async saveQueue(): Promise<void> {
		this.plugin.settings.autoPushQueue = [...this.queue];
		await this.plugin.saveSettings();
	}
}
