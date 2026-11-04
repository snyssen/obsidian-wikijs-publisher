# Wiki.js Publisher

An [Obsidian](https://obsidian.md) plugin to send your notes to a [Wiki.js](https://js.wiki) instance.

> [!WARNING]
> Work in progress.

## Development

The development environment is handled by [Nix](https://nixos.org/) (loaded with [direnv](https://direnv.net/)), uses [Just](https://github.com/casey/just) as a task runner and [Pre-commit](https://pre-commit.com/) for checks on each commit.

### Prerequisites

- Nix with flakes enabled
- direnv
- Docker with the compose plugin (for the throwaway Wiki.js instance)

Everything else (Node.js, Obsidian, jq, ...) is provided by the Nix devshell.

### First start

```bash
direnv allow   # load the devshell
just setup     # install pre-commit hooks and npm dependencies, prepare the dev vault
```

Run `just` to list all available recipes.

### Throwaway Wiki.js instance

```bash
just wiki-up     # start Wiki.js + Postgres and seed them
just wiki-reset  # start over from a fresh instance
just wiki-down   # stop it (data is kept)
```

Wiki.js is served on <http://localhost:3080> (set `WIKI_PORT` and `WIKI_URL` to change it). Seeding is idempotent and:

- runs the first-time setup with the `admin@example.com` / `admin12345` admin account,
- enables the GraphQL API and creates a full-access API key, saved in `dev/wikijs/.api-key`,
- creates a few sample pages.

### Throwaway Obsidian instance

```bash
just obsidian  # launch Obsidian on the dev vault
just dev       # build the plugin in watch mode, straight into the dev vault
```

`just obsidian` launches Obsidian with its configuration stored in `dev/obsidian-config/` instead of `~/.config/obsidian`, so it is fully isolated from your main installation (it can even run alongside it). It opens the sample vault in `dev/vault/`, which comes with the [Hot Reload](https://github.com/pjeby/hot-reload) plugin: the plugin is reloaded automatically each time `just dev` rebuilds it.

On first launch, Obsidian asks whether you trust the vault's author: select **Trust author and enable plugins**. This choice is kept in `dev/obsidian-config/`; run `just obsidian-reset` to start over.

### Releasing

Bump `version` in `manifest.json` and `versions.json` (`npm version patch|minor|major` does it for you), then push a tag matching the version exactly (no leading `v`). The release workflow builds the plugin and creates a draft GitHub release with `main.js`, `manifest.json` and `styles.css`.
