import { App, Modal, Setting } from 'obsidian';

interface ConfirmOptions {
	title: string;
	/** Paragraphs, then an optional list. */
	message: string[];
	list?: string[];
	cta: string;
}

/** Asks for a confirmation. Resolves to false when the modal is dismissed. */
export function confirm(app: App, options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => new ConfirmModal(app, options, resolve).open());
}

class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly options: ConfirmOptions,
		private readonly resolve: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.options.title);
		for (const paragraph of this.options.message) this.contentEl.createEl('p', { text: paragraph });
		if (this.options.list?.length) {
			const list = this.contentEl.createEl('ul');
			for (const item of this.options.list) list.createEl('li', { text: item });
		}
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(this.options.cta)
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(this.confirmed);
	}
}
