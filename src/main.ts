import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
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

	async onload() {
		await this.loadSettings();
		this.registry = new PushRegistry((this.settings.pushedPages ??= {}), () => this.saveSettings());
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => void this.registry.rename(oldPath, file.path)));

		this.addSettingTab(new WikiJsPublisherSettingTab(this.app, this));
		registerCommands(this);
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
