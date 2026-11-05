// Wiki.js 3 only accepts letters, digits, spaces, `_`, `-` and `/` in page paths (no dots).
// Paths are kept within that set for both versions so a vault can move from v2 to v3.
const WIKI_PATH = /^\/?[\p{L}\p{M}\p{N}\s_/-]*$/u;

export function isValidWikiPath(path: string): boolean {
	return path.length <= 255 && WIKI_PATH.test(path);
}

/** Lowercases a single path segment or file name stem, and keeps it to letters, digits, `-` and `_`. */
export function slugify(value: string): string {
	return value
		.normalize('NFC')
		.toLowerCase()
		.replace(/[\s.]+/g, '-')
		.replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '')
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Slugifies every segment of a path, without leading or trailing slashes: `My Notes/Read me` → `my-notes/read-me`. */
export function toWikiPath(path: string): string {
	return path
		.split('/')
		.map(slugify)
		.filter((segment) => segment !== '')
		.join('/');
}

/** Slugifies a file name, keeping its extension: `My Image_1.PNG` → `my-image_1.png`. */
export function toAssetFileName(fileName: string): string {
	const dot = fileName.lastIndexOf('.');
	if (dot <= 0) return slugify(fileName);
	const stem = slugify(fileName.slice(0, dot)) || 'file';
	const ext = slugify(fileName.slice(dot + 1));
	return ext ? `${stem}.${ext}` : stem;
}
