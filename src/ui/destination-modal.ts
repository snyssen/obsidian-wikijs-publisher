import { App, Modal, Setting } from 'obsidian';
import { isValidWikiPath } from '../wiki/paths';

interface DestinationOptions {
	/** Prefilled destination. */
	initial: string;
	/** Wiki path the pushed page gets for a given destination, shown as a preview. */
	pagePath: (destination: string) => string;
}

/** Asks where to push. Resolves to the destination, or null if the modal was dismissed. */
export function askDestination(app: App, options: DestinationOptions): Promise<string | null> {
	return new Promise((resolve) => new DestinationModal(app, options, resolve).open());
}

class DestinationModal extends Modal {
	private destination: string;
	private submitted = false;

	constructor(
		app: App,
		private readonly options: DestinationOptions,
		private readonly resolve: (destination: string | null) => void,
	) {
		super(app);
		this.destination = options.initial;
	}

	onOpen(): void {
		this.setTitle('Push to Wiki.js');

		const field = new Setting(this.contentEl).setName('Destination');
		let submitButton: HTMLButtonElement | undefined;
		const refresh = () => {
			const error = this.validate();
			field.setDesc(error ?? `Page: /${this.options.pagePath(this.destination)}`);
			field.descEl.toggleClass('mod-warning', error !== undefined);
			submitButton?.toggleAttribute('disabled', error !== undefined);
		};

		field.addText((text) => {
			text.setPlaceholder('Wiki root').setValue(this.destination);
			text.onChange((value) => {
				this.destination = value;
				refresh();
			});
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' && !event.isComposing) {
					event.preventDefault();
					this.submit();
				}
			});
			// Let the user type over the prefilled value straight away
			window.setTimeout(() => text.inputEl.select(), 0);
		});

		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => {
				submitButton = button.buttonEl;
				button.setButtonText('Push').setCta().onClick(() => this.submit());
			});

		refresh();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) this.resolve(null);
	}

	private validate(): string | undefined {
		if (!isValidWikiPath(this.destination)) return 'Only letters, digits, spaces, -, _ and / are allowed';
		if (this.options.pagePath(this.destination) === '') return 'This note has no letters or digits to name the page with';
		return undefined;
	}

	private submit(): void {
		if (this.validate() !== undefined) return;
		this.submitted = true;
		this.resolve(this.destination.trim());
		this.close();
	}
}
