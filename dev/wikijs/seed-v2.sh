#!/usr/bin/env bash
# Seeds the throwaway Wiki.js v2 instance: runs first-time setup, enables the API,
# creates an API key (saved to dev/wikijs/.api-key-v2) and a few sample pages.
# Safe to run multiple times.
# GraphQL queries use $variables, which must not be expanded by the shell
# shellcheck disable=SC2016
set -euo pipefail

WIKI_URL="${WIKI_URL:-http://localhost:3080}"
WIKI_ADMIN_EMAIL="${WIKI_ADMIN_EMAIL:-admin@example.com}"
WIKI_ADMIN_PASSWORD="${WIKI_ADMIN_PASSWORD:-admin12345}"
API_KEY_FILE="$(dirname "$0")/.api-key-v2"

log() { echo -e "\e[34;1m[seed-v2]\e[0m $*"; }

# gql <bearer token> <query> [variables json]
gql() {
	local token="$1" query="$2" vars="${3:-"{}"}"
	curl -sf -X POST "$WIKI_URL/graphql" \
		-H 'Content-Type: application/json' \
		${token:+-H "Authorization: Bearer $token"} \
		-d "$(jq -n --arg q "$query" --argjson v "$vars" '{query: $q, variables: $v}')"
}

wait_for_wiki() {
	log "Waiting for Wiki.js at $WIKI_URL..."
	for _ in $(seq 120); do
		curl -sf -o /dev/null "$WIKI_URL/healthz" && return 0
		sleep 1
	done
	echo "Wiki.js did not come up in time" >&2
	exit 1
}

# In setup mode, the GraphQL endpoint does not exist yet
is_setup_mode() {
	[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$WIKI_URL/graphql")" = 404 ]
}

wait_for_wiki

if is_setup_mode; then
	log "Running first-time setup..."
	curl -sf -X POST "$WIKI_URL/finalize" -H 'Content-Type: application/json' \
		-d "$(jq -n --arg e "$WIKI_ADMIN_EMAIL" --arg p "$WIKI_ADMIN_PASSWORD" --arg u "$WIKI_URL" \
			'{adminEmail: $e, adminPassword: $p, adminPasswordConfirm: $p, siteUrl: $u, telemetry: false}')" >/dev/null
	# Wiki.js restarts itself after setup
	for _ in $(seq 120); do
		is_setup_mode || break
		sleep 1
	done
	wait_for_wiki
else
	log "Setup already done."
fi

log "Logging in as $WIKI_ADMIN_EMAIL..."
JWT=$(gql "" 'mutation ($u: String!, $p: String!) {
	authentication { login(username: $u, password: $p, strategy: "local") { responseResult { succeeded message } jwt } }
}' "$(jq -n --arg u "$WIKI_ADMIN_EMAIL" --arg p "$WIKI_ADMIN_PASSWORD" '{u: $u, p: $p}')" |
	jq -r '.data.authentication.login.jwt // empty')
[ -n "$JWT" ] || { echo "Login failed" >&2; exit 1; }

log "Enabling API access..."
gql "$JWT" 'mutation { authentication { setApiState(enabled: true) { responseResult { succeeded } } } }' >/dev/null

if [ -s "$API_KEY_FILE" ] && gql "$(cat "$API_KEY_FILE")" '{ pages { list(limit: 1) { id } } }' | jq -e '.data.pages.list' >/dev/null; then
	log "Existing API key in $API_KEY_FILE is still valid."
else
	log "Creating API key..."
	gql "$JWT" 'mutation { authentication { createApiKey(name: "obsidian-dev", expiration: "1y", fullAccess: true) {
		responseResult { succeeded message } key } } }' |
		jq -r '.data.authentication.createApiKey.key' >"$API_KEY_FILE"
fi

# create_page <path> <title> <tags json array> <content>
create_page() {
	local result
	result=$(gql "$JWT" 'mutation ($path: String!, $title: String!, $tags: [String]!, $content: String!) {
		pages { create(path: $path, title: $title, tags: $tags, content: $content, description: "",
			editor: "markdown", isPublished: true, isPrivate: false, locale: "en") { responseResult { succeeded message } } }
	}' "$(jq -n --arg path "$1" --arg title "$2" --argjson tags "$3" --arg content "$4" \
		'{path: $path, title: $title, tags: $tags, content: $content}')")
	if jq -e '.data.pages.create.responseResult.succeeded' <<<"$result" >/dev/null; then
		log "Created page /$1"
	else
		log "Skipped page /$1 ($(jq -r '.data.pages.create.responseResult.message // .errors[0].message' <<<"$result"))"
	fi
}

create_page home "Home" '[]' '# Welcome

This is a throwaway Wiki.js instance used to develop the Wiki.js Publisher Obsidian plugin.

- [Getting started](/guides/getting-started)'

create_page guides/getting-started "Getting started" '["guide", "sample"]' '# Getting started

A nested sample page with some tags.

> This is a Wiki.js info callout.
{.is-info}'

log "Done. Wiki.js: $WIKI_URL (login: $WIKI_ADMIN_EMAIL / $WIKI_ADMIN_PASSWORD)"
log "API key: $(cat "$API_KEY_FILE")"
