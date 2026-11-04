import { detectVersion } from './detect';
import { HttpFn, WikiApiError } from './http';
import { ConnectionInfo, WikiClient, WikiConfig } from './types';
import { V2Client } from './v2/client';
import { V3Client } from './v3/client';

export async function createClient(http: HttpFn, config: WikiConfig): Promise<WikiClient> {
	if (!config.url) throw new WikiApiError('Set the Wiki.js URL in the plugin settings');
	if (!config.token) throw new WikiApiError('Set the API token in the plugin settings');

	const version = config.version === 'auto' ? await detectVersion(http, config.url) : config.version;
	return version === 'v3'
		? new V3Client(http, config.url, config.token)
		: new V2Client(http, config.url, config.token);
}

/** Connects with the configured settings, also checking that a manually set version matches the server. */
export async function testConnection(http: HttpFn, config: WikiConfig): Promise<ConnectionInfo> {
	const client = await createClient(http, config);
	if (config.version !== 'auto') {
		const detected = await detectVersion(http, config.url);
		if (detected !== config.version) {
			throw new WikiApiError(
				`The server runs Wiki.js ${detected}, but the settings force ${config.version}`,
			);
		}
	}
	return client.checkConnection();
}
