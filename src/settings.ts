import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import { runConnectionTest } from './commands/test-connection';
import type WikiJsPublisherPlugin from './main';
import { isValidWikiPath } from './wiki/paths';
import { WikiConfig } from './wiki/types';

export interface WikiJsPublisherSettings {
	wikiUrl: string;
	/** Id of the token in Obsidian's secret storage, not the token itself. */
	apiTokenSecret: string;
	apiVersion: WikiConfig['version'];
	locale: string;
	defaultDestination: string;
}

export const DEFAULT_SETTINGS: WikiJsPublisherSettings = {
	wikiUrl: '',
	apiTokenSecret: '',
	apiVersion: 'auto',
	locale: '',
	defaultDestination: '',
};

type SettingKey = keyof WikiJsPublisherSettings;

// Values are read from and persisted to `plugin.settings` by PluginSettingTab itself
export class WikiJsPublisherSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: WikiJsPublisherPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				type: 'group',
				heading: 'Connection',
				items: [
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
					{
						name: 'API token',
						desc: 'Wiki.js 2: an API key with full access. Wiki.js 3: a personal access token with the pages:write and assets:write scopes.',
						control: { type: 'secret', key: 'apiTokenSecret' },
					},
					{
						name: 'Wiki.js version',
						desc: 'Leave on automatic unless detection fails.',
						control: {
							type: 'dropdown',
							key: 'apiVersion',
							options: { auto: 'Automatic', v2: 'Wiki.js 2', v3: 'Wiki.js 3' },
						},
					},
					{
						name: 'Test connection',
						desc: 'Check that the wiki answers and accepts the token.',
						action: () => void runConnectionTest(this.plugin),
					},
				],
			},
			{
				type: 'group',
				heading: 'Publishing',
				items: [
					{
						name: 'Locale',
						desc: "Locale of the pages to create, such as en or fr. Leave empty to use the wiki's primary locale.",
						control: { type: 'text', key: 'locale', placeholder: 'en', validate: validateLocale },
					},
					{
						name: 'Default destination',
						desc: 'Wiki path that notes are pushed under by default. Leave empty to push to the root of the wiki.',
						control: {
							type: 'text',
							key: 'defaultDestination',
							placeholder: 'notes/from-obsidian',
							validate: validateDestination,
						},
					},
				],
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

function validateLocale(value: string): string | void {
	if (value !== '' && !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(value)) {
		return 'Enter a locale code, such as en or pt-br';
	}
}

function validateDestination(value: string): string | void {
	if (!isValidWikiPath(value)) {
		return 'Only letters, digits, spaces, -, _ and / are allowed';
	}
}
