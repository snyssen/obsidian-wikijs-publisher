plugin_id := "wikijs-publisher"
vault_dir := justfile_directory() / "dev/vault"
plugin_dir := vault_dir / ".obsidian/plugins" / plugin_id
obsidian_config_dir := justfile_directory() / "dev/obsidian-config"
wiki_url := env("WIKI_URL", "http://localhost:3080")

default:
  just --list

# Initial setup for entire repository
setup: setup-pre-commit setup-npm vault-setup

# Setup pre-commit hooks
setup-pre-commit:
  pre-commit install

# Install npm dependencies
setup-npm:
  npm ci

# Build the plugin in watch mode, straight into the dev vault
dev: vault-setup
  OBSIDIAN_PLUGIN_DIR="{{plugin_dir}}" npm run dev

# Production build (outputs main.js at the repository root)
build:
  npm run build

# Lint the project
lint:
  npm run lint

# Install hot-reload and prepare the plugin folder in the dev vault, and register the vault in the throwaway Obsidian config
vault-setup:
  #!/usr/bin/env bash
  set -euo pipefail
  hot_reload_dir="{{vault_dir}}/.obsidian/plugins/hot-reload"
  mkdir -p "$hot_reload_dir" "{{plugin_dir}}"
  install -m 644 "$HOT_RELOAD_PLUGIN/main.js" "$HOT_RELOAD_PLUGIN/manifest.json" "$hot_reload_dir/"
  touch "{{plugin_dir}}/.hotreload"
  config_file="{{obsidian_config_dir}}/obsidian/obsidian.json"
  if [ ! -f "$config_file" ]; then
    mkdir -p "$(dirname "$config_file")"
    jq -n --arg path "{{vault_dir}}" --argjson ts "$(date +%s000)" \
      '{vaults: {"0b51d1a4e1b0a5e1": {path: $path, ts: $ts, open: true}}}' > "$config_file"
  fi

# ELECTRON_RUN_AS_NODE can leak from VS Code terminals and would make Obsidian start as plain Node

# Launch a throwaway Obsidian instance (isolated from your main config) on the dev vault
obsidian: vault-setup
  env -u ELECTRON_RUN_AS_NODE XDG_CONFIG_HOME="{{obsidian_config_dir}}" setsid obsidian >/dev/null 2>&1 &

# Delete the throwaway Obsidian config (vault notes are kept)
obsidian-reset:
  rm -rf "{{obsidian_config_dir}}"

# Start the throwaway Wiki.js instance and seed it
wiki-up:
  docker compose up -d
  just wiki-seed

# Seed Wiki.js: first-time setup, API key and sample pages (idempotent)
wiki-seed:
  WIKI_URL="{{wiki_url}}" ./dev/wikijs/seed.sh

# Stop the Wiki.js instance (data is kept)
wiki-down:
  docker compose down

# Destroy the Wiki.js instance and its data, then start a fresh seeded one
wiki-reset:
  docker compose down -v
  rm -f dev/wikijs/.api-key
  just wiki-up

# Follow Wiki.js logs
wiki-logs:
  docker compose logs -f wiki
