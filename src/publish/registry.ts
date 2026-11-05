/** Wiki path of each pushed note, by vault path. */
export type PushedPages = Record<string, string>;

/** Pushed pages of every wiki pushed to, by wiki URL: links resolve against the wiki being pushed to. */
export type PushRegistryData = Record<string, PushedPages>;

/** Where notes were last pushed, so links between notes point to the right pages. */
export class PushRegistry {
	constructor(
		private readonly data: PushRegistryData,
		private readonly save: () => Promise<void>,
	) {}

	get(wikiUrl: string, vaultPath: string): string | undefined {
		return this.data[key(wikiUrl)]?.[vaultPath];
	}

	async set(wikiUrl: string, vaultPath: string, wikiPath: string): Promise<void> {
		(this.data[key(wikiUrl)] ??= {})[vaultPath] = wikiPath;
		await this.save();
	}

	/** Follows a note renamed or moved in the vault: its page stays where it is on the wiki. */
	async rename(oldPath: string, newPath: string): Promise<void> {
		let changed = false;
		for (const pages of Object.values(this.data)) {
			const wikiPath = pages[oldPath];
			if (wikiPath === undefined) continue;
			delete pages[oldPath];
			pages[newPath] = wikiPath;
			changed = true;
		}
		if (changed) await this.save();
	}
}

function key(wikiUrl: string): string {
	return wikiUrl.trim().replace(/\/+$/, '');
}
