import { Plugin, TFile, TFolder, Vault } from 'obsidian';
import { registerCommands } from './commands';
import { AutoPusher } from './publish/auto-push';
import { DestinationFollower } from './publish/follow-moves';
import { PushRegistry } from './publish/registry';
import {
	DEFAULT_SETTINGS,
	WikiJsPublisherSettings,
	WikiJsPublisherSettingTab,
} from './settings';
import { WikiConfig } from './wiki/types';

export default class WikiJsPublisherPlugin extends Plugin {
	settings!: WikiJsPublisherSettings;
	registry!: PushRegistry;
	declinedOverwrites!: PushRegistry;
	autoPusher!: AutoPusher;
	private follower!: DestinationFollower;

	async onload() {
		await this.loadSettings();
		this.registry = new PushRegistry((this.settings.pushedPages ??= {}), () => this.saveSettings());
		this.declinedOverwrites = new PushRegistry((this.settings.declinedOverwrites ??= {}), () => this.saveSettings());
		this.autoPusher = new AutoPusher(this);
		this.follower = new DestinationFollower(this);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				void this.registry.rename(oldPath, file.path);
				void this.declinedOverwrites.rename(oldPath, file.path);
				this.follower.onRename(file, oldPath);
				if (file instanceof TFile) this.autoPusher.onRename(file, oldPath);
				else if (file instanceof TFolder) {
					// The notes of a moved folder (Obsidian may not report them one by one)
					Vault.recurseChildren(file, (child) => {
						if (child instanceof TFile) this.autoPusher.onRename(child, oldPath + child.path.slice(file.path.length));
					});
				}
			}),
		);
		this.registerEvent(this.app.metadataCache.on('changed', (file) => this.autoPusher.onChange(file)));
		this.app.workspace.onLayoutReady(() => this.autoPusher.start());

		this.addSettingTab(new WikiJsPublisherSettingTab(this.app, this));
		registerCommands(this);
	}

	onunload() {
		this.autoPusher.unload();
		this.follower.unload();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<WikiJsPublisherSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getWikiConfig(): WikiConfig {
		const { wikiUrl, apiTokenSecret, apiVersion, locale } = this.settings;
		const token = apiTokenSecret ? this.app.secretStorage.getSecret(apiTokenSecret) : null;
		return { url: wikiUrl, token: token ?? '', version: apiVersion, locale };
	}
}
