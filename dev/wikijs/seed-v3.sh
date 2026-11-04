#!/usr/bin/env bash
# Seeds the throwaway Wiki.js v3 instance: logs in as the admin (created from the
# ADMIN_* env vars of the container), enables the API, creates a personal access
# token (saved to dev/wikijs/.api-key-v3) and a few sample pages.
# Safe to run multiple times.
set -euo pipefail

WIKI_URL="${WIKI_URL:-http://localhost:3081}"
WIKI_ADMIN_EMAIL="${WIKI_ADMIN_EMAIL:-admin@example.com}"
WIKI_ADMIN_PASSWORD="${WIKI_ADMIN_PASSWORD:-admin12345}"
API_KEY_FILE="$(dirname "$0")/.api-key-v3"

COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

log() { echo -e "\e[35;1m[seed-v3]\e[0m $*"; }

# api <method> <path> [json body] — authenticated with the session cookie
api() {
	curl -sf -X "$1" "$WIKI_URL/_api$2" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
		${3:+-H 'Content-Type: application/json' -d "$3"}
}

# token_status <path> — HTTP status of a GET authenticated with the personal access token
token_status() {
	curl -s -o /dev/null -w '%{http_code}' "$WIKI_URL/_api$1" -H "Authorization: Bearer $(cat "$API_KEY_FILE")"
}

log "Waiting for Wiki.js at $WIKI_URL..."
for _ in $(seq 120); do
	curl -sf -o /dev/null "$WIKI_URL/_api/sites/current" && break
	sleep 1
done

SITE_ID=$(api GET /sites/current | jq -r .id)
STRATEGY_ID=$(api GET "/sites/$SITE_ID/auth/strategies" |
	jq -r 'first(.[] | select(.activeStrategy.strategy.key == "local")) | .id')

log "Logging in as $WIKI_ADMIN_EMAIL..."
api PUT "/sites/$SITE_ID/auth/login" "$(jq -n --arg s "$STRATEGY_ID" --arg u "$WIKI_ADMIN_EMAIL" --arg p "$WIKI_ADMIN_PASSWORD" \
	'{strategyId: $s, username: $u, password: $p}')" >/dev/null

log "Enabling API access..."
api PUT /system/api '{"isEnabled": true}' >/dev/null

# A fresh v3 install is private: the Guests group's default rule DENIES reading.
# Flip it to ALLOW so anonymous visitors can read pages, like on v2.
log "Making the wiki publicly readable..."
GUESTS_ID=$(api GET /groups | jq -r 'first(.[] | select(.name == "Guests")) | .id')
api PUT "/groups/$GUESTS_ID" "$(api GET "/groups/$GUESTS_ID" |
	jq '{rules: [.rules[] | if .name == "Default Rule" then .mode = "ALLOW" else . end]}')" >/dev/null

if [ -s "$API_KEY_FILE" ] && [ "$(token_status "/sites/$SITE_ID/pages/search?limit=1")" = 200 ]; then
	log "Existing token in $API_KEY_FILE is still valid."
else
	log "Creating personal access token..."
	api POST /users/profile/tokens '{"name": "obsidian-dev", "expiration": "1y", "scopes": ["pages:write", "assets:write"]}' |
		jq -r .token >"$API_KEY_FILE"
fi

# create_page <path> <title> <tags json array> <content>
create_page() {
	local body result page_id
	body=$(jq -n --arg path "$1" --arg title "$2" --argjson tags "$3" --arg content "$4" \
		'{path: $path, title: $title, tags: $tags, content: $content, editor: "markdown"}')
	result=$(curl -s -X POST "$WIKI_URL/_api/sites/$SITE_ID/pages" -b "$COOKIE_JAR" \
		-H 'Content-Type: application/json' -d "$body")
	page_id=$(jq -r '.page.id // empty' <<<"$result")
	if [ -n "$page_id" ]; then
		# v3 does not render Markdown on save: queue a server-side render
		api POST "/sites/$SITE_ID/pages/$page_id/render" >/dev/null
		log "Created page /$1"
	else
		log "Skipped page /$1 ($(jq -r '.message' <<<"$result"))"
	fi
}

create_page home "Home" '[]' '# Welcome

This is a throwaway Wiki.js v3 instance used to develop the Wiki.js Publisher Obsidian plugin.

- [Getting started](/guides/getting-started)'

create_page guides/getting-started "Getting started" '["guide", "sample"]' '# Getting started

A nested sample page with some tags.

> This is a Wiki.js info callout.
{.is-info}'

log "Done. Wiki.js: $WIKI_URL (login: $WIKI_ADMIN_EMAIL / $WIKI_ADMIN_PASSWORD)"
log "Personal access token: $(cat "$API_KEY_FILE")"
