import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	WikiJsPublisherSettings,
	WikiJsPublisherSettingTab,
} from './settings';

export default class WikiJsPublisherPlugin extends Plugin {
	settings!: WikiJsPublisherSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new WikiJsPublisherSettingTab(this.app, this));
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
}
