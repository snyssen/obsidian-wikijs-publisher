import { Notice } from 'obsidian';
import { RemotePage } from '../wiki/types';

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Notice with a link to the pushed page, and its warning if any. */
export function showPushedNotice(label: string, page: RemotePage): void {
	new Notice(
		createFragment((f) => {
			f.appendText(`${label}: `);
			f.createEl('a', { text: page.url, href: page.url });
			if (page.warning) f.appendText(`. ${page.warning}`);
		}),
		10000,
	);
}
