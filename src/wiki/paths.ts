// Wiki.js 3 only accepts letters, digits, spaces, `_`, `-` and `/` in page paths (no dots).
// Paths are kept within that set for both versions so a vault can move from v2 to v3.
const WIKI_PATH = /^\/?[\p{L}\p{M}\p{N}\s_/-]*$/u;

export function isValidWikiPath(path: string): boolean {
	return path.length <= 255 && WIKI_PATH.test(path);
}
