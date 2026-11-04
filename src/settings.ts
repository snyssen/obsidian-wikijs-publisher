import { PluginSettingTab, SettingDefinitionItem } from 'obsidian';

export interface WikiJsPublisherSettings {
	wikiUrl: string;
}

export const DEFAULT_SETTINGS: WikiJsPublisherSettings = {
	wikiUrl: '',
};

type SettingKey = keyof WikiJsPublisherSettings;

// Values are read from and persisted to `plugin.settings` by PluginSettingTab itself
export class WikiJsPublisherSettingTab extends PluginSettingTab {
	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				name: 'Wiki.js URL',
				desc: 'Base URL of your Wiki.js instance.',
				control: {
					type: 'text',
					key: 'wikiUrl',
					placeholder: 'https://wiki.example.com',
					validate: validateUrl,
				},
			},
		];
	}
}

function validateUrl(value: string): string | void {
	if (value === '') return;
	try {
		const { protocol } = new URL(value);
		if (protocol !== 'http:' && protocol !== 'https:') {
			return 'The URL must start with http:// or https://';
		}
	} catch {
		return 'Enter a valid URL';
	}
}
