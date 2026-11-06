// Checks on the pages a push is about to create (no Obsidian import)

export interface PlannedPage {
	/** Vault path of the note. */
	vaultPath: string;
	/** Wiki path of its page. */
	path: string;
}

/**
 * Notes that can't be pushed as planned, with the reason: no usable page path, or the same page path as
 * another note of the push (only the first one keeps it).
 */
export function planErrors(pages: PlannedPage[]): Map<string, string> {
	const errors = new Map<string, string>();
	const owners = new Map<string, string>();
	for (const { vaultPath, path } of pages) {
		const owner = owners.get(path);
		if (path === '') errors.set(vaultPath, 'its name has no letters or digits to build a wiki path from');
		else if (owner !== undefined) errors.set(vaultPath, `it would be pushed to the same page as ${owner} (/${path})`);
		else owners.set(path, vaultPath);
	}
	return errors;
}

/** Whether a frontmatter value marks a note for publishing: `true`, or a non-empty value other than `false`. */
export function isMarkedForPublishing(value: unknown): boolean {
	if (typeof value === 'string') return value.trim() !== '' && value.trim().toLowerCase() !== 'false';
	return value !== undefined && value !== null && value !== false;
}
