export type WikiVersion = 'v2' | 'v3';

export interface WikiConfig {
	url: string;
	token: string;
	/** `auto` detects the version from the server. */
	version: WikiVersion | 'auto';
}

export interface ConnectionInfo {
	version: WikiVersion;
	/** Exact server version, when the API exposes it to the token. */
	serverVersion?: string;
	/** Site title (v3 can serve several sites). */
	site?: string;
}

export interface WikiClient {
	readonly version: WikiVersion;
	/** Checks that the server answers and accepts the token. Throws a WikiApiError otherwise. */
	checkConnection(): Promise<ConnectionInfo>;
}
