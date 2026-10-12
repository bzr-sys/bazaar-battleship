# Bazaar Battleship

The classic two-player Battleship game, built as a [Bazaar](https://bzr.dev) example app. There is no app backend: every game is stored in its host's own Bazaar database and shared with the opponent through Bazaar permissions.

**Live app: https://bzr-sys.github.io/bazaar-battleship/**

## Features

- Sign up or log in with a Bazaar account
- Challenge another Bazaar user directly (**Find User**), or create a one-time invite link (**Create Link**) to send to anyone
- Place your five ships, then take turns bombing your opponent's grid
- Rematches keep a running highscore per opponent
- Games update live for both players

## How it uses Bazaar

| Bazaar feature        | Used for                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Collections (`games`) | Each player keeps their games in their own `games` collection                            |
| Permissions           | The host grants the guest read/update access to that one game (`filter: { id: gameId }`) |
| Shareable links       | **Create Link** makes a single-use link that grants the same access to whoever opens it  |
| Granted permissions   | The guest's app watches for new grants and adds the game to their list                   |
| Contexts              | The guest reads and updates the game in the host's database                              |
| Subscriptions         | Both players get board changes in real time                                              |

The Bazaar setup is in `src/bazaar.ts`, and the game logic is in `src/stores/bazaar.ts` and `src/views/GameView.vue`.

## Tech stack

Vue 3, Vite, Pinia, Vue Router (hash history), Tailwind CSS, and the [`@bzr/bazaar`](https://www.npmjs.com/package/@bzr/bazaar) SDK.

## Run locally

You need Node.js 24 or newer (required by the mock server) and pnpm 9 (`npm install -g pnpm@9`, or `corepack enable`).

In development the app talks to a local Bazaar mock server on `http://localhost:3377` instead of the real service (see `src/bazaar.ts`). The mock is installed as a dev dependency ([`@bzr/bazaar-mock`](https://www.npmjs.com/package/@bzr/bazaar-mock)).

```sh
pnpm install

# Terminal 1: start the mock server and register the app's dev URL
pnpm exec bzr -u http://localhost:5173/bazaar-battleship/

# Terminal 2: start the app against the mock app ID "test"
VITE_APP_ID=test pnpm dev
```

Open http://localhost:5173/bazaar-battleship/ and click **Sign up or Log in**. In the popup:

1. Enter any email address and click **Log In or Sign Up**. There is no password or code.
2. First time only: pick a handle (at least 4 letters or digits) and a name, then click **Complete Setup**. The popup then shows the Bazaar dashboard instead of returning to the app. This is a known mock issue: close the popup and click **Sign up or Log in** again.
3. Click **Authorize**.

To play against yourself, open a second browser profile or a private window and sign up with a different email. Both players use the same mock server.

Notes:

- The mock keeps its data in memory, so restarting it wipes all users and games.
- The redirect URL has to match exactly. If Vite starts on a port other than 5173, restart the mock with that URL (`pnpm exec bzr -u http://localhost:<port>/bazaar-battleship/`).
- `pnpm exec bzr -h` lists the other mock options (app ID, port, extra redirect URIs).

### Scripts

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Start the Vite dev server with hot reload        |
| `pnpm build`      | Type-check and build for production into `dist/` |
| `pnpm preview`    | Serve the production build locally               |
| `pnpm type-check` | Run `vue-tsc`                                    |
| `pnpm lint`       | Run ESLint (with `--fix`)                        |
| `pnpm format`     | Format `src/` with Prettier                      |

## Deployment

Every push to `main` runs `.github/workflows/build_battleship.yml`. It builds the app with the production Bazaar app ID (`VITE_APP_ID`) and publishes `dist/` to GitHub Pages at https://bzr-sys.github.io/bazaar-battleship/.

The Pages path is set by `base` in `vite.config.ts`. If you deploy somewhere else, change `base`, and register the new URL as a redirect URI for the app in the [Bazaar dashboard](https://cloud.bzr.dev).
