# Remybot

An LCD virtual pet for children aged 6–9, with simple daily chores. Built with React, TypeScript, Vinext, and Cloudflare D1.

## What it does

- Six eggs, each with an origin story and its own creature family.
- A 60-second first hatch, with an LCD countdown and progress meter.
- Metamorphosis unlocks every five calendar days. Each transformation includes an entering animation, a 60-second cocoon, and an emergence animation.
- Hatchling, growing, and flourishing forms, followed by recurring renewal forms and changing care marks.
- Happy, sad, hungry, and sleeping expressions at every creature stage.
- Three default chores: Put shoes away, Brush teeth, Empty lunch box. Chores can be edited or expanded to six.
- Saved check-ins shape the next care trait. Incomplete chores produce a sad face; completing them produces a happy face. Hunger and sleep take visual priority.
- Garden bowls, apples, and star biscuits. Each species has distinct likes/dislikes. A favourite fills two tummy blocks; a disliked food gets a one-block nibble. Hunger decays by one block per eight real hours and never causes death or lost growth.
- Twenty-minute naps, with an optional early wake-up.
- Post-hatch story and care guide, growth history, optional sound, and reduced-motion support.
- A centred device view, with a right-side chores/care drawer. Responsive layouts were checked at iPad portrait/landscape and phone widths.

Daily prompts appear in the app. This version does not send notifications while closed. Three creature silhouettes per family repeat as renewal forms after the initial stages; later renewals are not an unlimited collection of new silhouettes.

## Run locally

Use Node.js 22.13 or later (Node 24 recommended) and npm.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_greedy_nicolaos.sql
npm run dev
```

Apply the migration only once to a fresh local database. The preview URL is printed by the dev server (normally http://127.0.0.1:5173). Local sign-in uses the starter’s loopback-only test identity; hosted identity comes from the Sites gateway. The production build excludes local auth simulation.

On Windows, if the npm shell shim fails, invoke the installed npm JavaScript entrypoint with Node.

## Persistence and timing

The server stores each signed-in user’s companion as a D1 record. Writes use revision checks to reject stale updates. The browser does not store pet progress in localStorage. No demo mode, test pet, simulated date, or development database is shipped with the application.

The hatch and cocoon deadlines are persisted server timestamps. Day boundaries follow the IANA timezone selected from the device when the egg is adopted. Food uses elapsed UTC hours. Completing or editing a check-in updates a single daily snapshot instead of granting duplicate rewards. Previous days retain their original chore labels. Revealed care traits are stable.

Reloading during incubation continues the timer. An expired cocoon emerges on the next visit; failures have a manual retry. After an extended absence, evolution catches up to the latest eligible chapter. The database is per signed-in adult account; multiple child profiles are not included.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The 41 tests cover hatch/cocoon boundaries, daylight-saving transitions, food decay and preferences, missed-day catch-up, chore edits, moods, persistence serialization, API validation/authentication, revision conflicts, and a stale-response regression. API tests mock the authentication and database I/O; the local browser flow was also exercised against D1.

## Source guide

- `app/remybot.tsx`: interface and interactions
- `app/engine.ts`: pure lifecycle, food, mood, and check-in rules
- `app/eggs.ts`, `app/lore.json`: egg origins and unlocked stories
- `app/api/pet/route.ts`: authenticated API and input validation
- `db/pets.ts`: prepared D1 statements and revision checks
- `db/schema.ts`, `drizzle/`: database schema and migration
- `public/sprites`, `public/moods`, `public/cocoons`: original image-generated LCD artwork
- `.openai/hosting.json`: Sites project and logical D1 binding

The page exposes a read-only `read_remybot_status` WebMCP tool where supported. It does not alter a pet.

## GitHub handoff

The source is prepared for the Remybot GitHub repository. Secrets, dependencies, build output, runtime state, and the local database are ignored. Sites publication uses its own private source repository. To host somewhere else, configure trusted authentication headers and the D1 binding; do not expose the Worker behind an untrusted header-injecting proxy.

