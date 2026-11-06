/** Wiki path of each pushed note, by vault path. */
export type PushedPages = Record<string, string>;

/** Pushed pages of every wiki pushed to, by wiki URL: links resolve against the wiki being pushed to. */
export type PushRegistryData = Record<string, PushedPages>;

/**
 * Wiki paths of notes, per wiki, kept in `data.json`. Used for where notes were last pushed (so links
 * between notes point to the right pages, and pages are moved rather than duplicated), and for the
 * overwrites the user refused.
 */
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

	async delete(wikiUrl: string, vaultPath: string): Promise<void> {
		const pages = this.data[key(wikiUrl)];
		if (pages?.[vaultPath] === undefined) return;
		delete pages[vaultPath];
		await this.save();
	}

	/** Follows a note (or a folder of notes) renamed or moved in the vault. */
	async rename(oldPath: string, newPath: string): Promise<void> {
		let changed = false;
		for (const pages of Object.values(this.data)) {
			for (const [vaultPath, wikiPath] of Object.entries(pages)) {
				if (vaultPath !== oldPath && !vaultPath.startsWith(`${oldPath}/`)) continue;
				delete pages[vaultPath];
				pages[newPath + vaultPath.slice(oldPath.length)] = wikiPath;
				changed = true;
			}
		}
		if (changed) await this.save();
	}
}

function key(wikiUrl: string): string {
	return wikiUrl.trim().replace(/\/+$/, '');
}
