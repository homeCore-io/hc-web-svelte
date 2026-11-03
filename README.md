# hc-web

The homeCore web app, and the UI server it runs in.

This is the redesign: a from-scratch client built from the design in
[`docs/design/`](docs/design/) — start with
[`decisions.md`](docs/design/decisions.md). The earlier Svelte client lives on
`main` and `develop` for reference only.

## What is here

- **The app** (`src/`) — Svelte 5 and SvelteKit, for phone, tablet, desktop
  and wall displays, in a light and a dark theme.
- **The UI server** (`server/`, and `src/routes/ui/`) — serves the app, passes
  homeCore's API and event stream through on one origin, keeps the sign-in in
  httpOnly cookies, and (from R4) stores the UI's own data: pages, layouts,
  preferences, files. homeCore keeps the house; the UI server keeps how it is
  shown (decision M1).

## Running it

```sh
npm install
cp .env.example .env        # set HC_CORE_URL to your homeCore
npm run dev                 # http://localhost:5180  (add --host to reach it from other machines)
```

Production:

```sh
npm run build && npm start  # PORT, HOST, HC_CORE_URL, HC_DATA_DIR
```

### Beside homeCore, as a container

Tagged releases publish `ghcr.io/homecore-io/hc-web-svelte` (`:<version>` and
`:latest`); a `:dev` image is built on request from the Actions tab. The
[docker repository](https://github.com/homeCore-io/docker)'s stack runs it on
port 3001. On its own:

```sh
docker run -d --name hc-web-svelte --restart unless-stopped \
  -p 3001:3000 \
  -e HC_CORE_URL=http://homecore:8080 \
  -v hc-web-svelte-data:/data \
  ghcr.io/homecore-io/hc-web-svelte:latest
```

`HC_CORE_URL` is how the container reaches homeCore — a compose service name,
or the host's address (`http://192.168.1.50:8080`). `/data` holds the UI
server's documents (pages, themes, displays): keep it on a volume, and back it
up with the house. `GET /ui/health` answers `{"ok":true}`.

### UI extensions

Extensions (drawings and cards the looks can choose, from
[hc-extensions](https://github.com/homeCore-io/hc-extensions)) are installed by
the UI server itself into `extensions/` under its data directory, from
Settings › Plugins › Catalog or from a file; homeCore never sees them. The
Catalog reads the registry's signed `extensions.json`:

- `HC_EXTENSIONS_INDEX`: its address (default
  `https://homecore.io/registry/extensions.json`); the signature is read from
  the same address plus `.sig`.
- `HC_REGISTRY_PUBLIC_KEY`: the key that signs it, base64 (default: the
  homeCore registry's, the same one homeCore trusts for plugins).

The UI server needs to reach that address and GitHub's release downloads to
install from the Catalog; adding from a file works offline.

## Checks

The same steps CI runs (`hc-scripts`' node-ci):

```sh
npm run typecheck     # types (svelte-check)
npm run lint          # svelte-check, failing on warnings
npm run format:check  # prettier
npm test              # unit tests — never send commands to a real house
npm run build && npm run budget   # the home's JavaScript must stay ≤ 200 KB compressed
```

## Security notes

- The UI server **never passes on a request that carries no credential**,
  except signing in. homeCore makes requests from whitelisted addresses admin
  without a token, and every request through the UI server comes from the UI
  server's address — so if that address is whitelisted, forwarding anonymous
  requests would make anybody who can reach the UI server an admin.
- Session cookies are `HttpOnly` and `SameSite=Strict`, and requests that
  change anything must come from the app's own origin.
- An extension from the Catalog is installed only if the index's signature
  holds and the file matches the index's checksum. Unpacking refuses links,
  paths outside the extension's folder, and more than 32 MB. Only people who
  may install plugins can add or remove one.
- Refresh tokens are used once each (homeCore revokes the session on reuse),
  so the UI server makes at most one refresh per token, however many requests
  arrive with it at once.

## Licence

MIT OR Apache-2.0.
