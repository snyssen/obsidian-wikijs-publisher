import { App, Modal, Setting, TFile } from 'obsidian';
import type { Collision, CollisionChoice } from '../publish/push';

const CHOICES: Record<CollisionChoice, string> = {
	skip: 'Skip',
	replace: 'Replace the page',
	exclude: 'Exclude the note',
};

/**
 * Asks what to do with pages standing where notes should be pushed. Resolves to a choice per note;
 * dismissing the modal skips them all.
 */
export function askCollisions(app: App, collisions: Collision[]): Promise<Map<TFile, CollisionChoice>> {
	return new Promise((resolve) => new CollisionsModal(app, collisions, resolve).open());
}

class CollisionsModal extends Modal {
	private readonly choices = new Map<TFile, CollisionChoice>();
	private applied = false;

	constructor(
		app: App,
		private readonly collisions: Collision[],
		private readonly resolve: (choices: Map<TFile, CollisionChoice>) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Pages already on the wiki');
		this.contentEl.createEl('p', {
			text: "These pages weren't pushed from these notes. Replacing one deletes it from the wiki.",
		});

		const rows = this.collisions.map((collision) => {
			this.choices.set(collision.file, 'skip');
			const row = new Setting(this.contentEl).setName(collision.file.path);
			row.descEl.appendText('Already at ');
			row.descEl.createEl('a', { text: `/${collision.path}`, href: collision.existing.url });
			let select: HTMLSelectElement | undefined;
			row.addDropdown((dropdown) => {
				select = dropdown.selectEl;
				dropdown
					.addOptions(CHOICES)
					.setValue('skip')
					.onChange((value) => this.choices.set(collision.file, value as CollisionChoice));
			});
			return { collision, select };
		});

		new Setting(this.contentEl)
			.setName('For all')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('', 'Choose…')
					.addOptions(CHOICES)
					.onChange((value) => {
						if (!(value in CHOICES)) return;
						for (const { collision, select } of rows) {
							this.choices.set(collision.file, value as CollisionChoice);
							if (select) select.value = value;
						}
					}),
			);

		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText('Apply')
					.setCta()
					.onClick(() => {
						this.applied = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(this.applied ? this.choices : new Map<TFile, CollisionChoice>());
	}
}
