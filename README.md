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
# or
docker build -t hc-web .
docker run -p 3000:3000 -e HC_CORE_URL=http://homecore:8080 -v hc-web-data:/data hc-web
```

## Checks

```sh
npm run check    # types (svelte-check)
npm test         # unit tests — never send commands to a real house
npm run lint     # formatting
npm run build && npm run budget   # the home's JavaScript must stay ≤ 150 KB compressed
```

## Security notes

- The UI server **never passes on a request that carries no credential**,
  except signing in. homeCore makes requests from whitelisted addresses admin
  without a token, and every request through the UI server comes from the UI
  server's address — so if that address is whitelisted, forwarding anonymous
  requests would make anybody who can reach the UI server an admin.
- Session cookies are `HttpOnly` and `SameSite=Strict`, and requests that
  change anything must come from the app's own origin.
- Refresh tokens are used once each (homeCore revokes the session on reuse),
  so the UI server makes at most one refresh per token, however many requests
  arrive with it at once.

## Licence

MIT OR Apache-2.0.
