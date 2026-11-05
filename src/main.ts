import { Plugin } from 'obsidian';
import { pushTestPage } from './commands/push-test-page';
import { runConnectionTest } from './commands/test-connection';
import {
	DEFAULT_SETTINGS,
	WikiJsPublisherSettings,
	WikiJsPublisherSettingTab,
} from './settings';
import { WikiConfig } from './wiki/types';

export default class WikiJsPublisherPlugin extends Plugin {
	settings!: WikiJsPublisherSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new WikiJsPublisherSettingTab(this.app, this));

		this.addCommand({
			id: 'test-connection',
			name: 'Test connection',
			callback: () => void runConnectionTest(this),
		});

		if (__DEV__) {
			this.addCommand({
				id: 'dev-push-test-page',
				name: 'Push test page (dev)',
				callback: () => void pushTestPage(this),
			});
		}
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
