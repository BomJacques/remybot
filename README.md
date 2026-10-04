# Remybot

[Play Remybot](https://bomjacques.github.io/remybot/)

An LCD virtual pet with simple daily chores, built for children aged 6–9. Runs entirely in the browser on GitHub Pages using React, TypeScript, and Vite. No login, GPT, AI service, API key, database, or application backend is required.

## Play

Choose one of six mystery eggs and give your companion a name. The first egg hatches in 60 seconds, with an LCD countdown and filling meter. Metamorphosis unlocks every new calendar day, with an entering animation, a 60-second cocoon, and an emergence animation. Existing saves retain their pet and can catch up to the new daily schedule.

- Three default chores: Put shoes away, Brush teeth, Empty lunch box. Edit them or add up to six.
- Incomplete chores produce a sad expression; completing them produces a happy one. Hunger and sleep take priority.
- Feed garden bowls, apples, and star biscuits. Each creature has its own food likes and dislikes. One tummy block fades every eight hours; pets never die or lose growth from hunger.
- Read each creature’s story and care guide after it hatches. Food, chores, cuddles, and naps shape the experience.
- Tap the creature to make him laugh. The Play button opens Catch the stars and Copy my moves, two untimed games with creature reactions and a saved count of completed games. Games never complete chores for you.
- Camera view places the LCD creature over a live camera picture. Drag him around, resize him, and tap to interact. This is a 2D camera overlay, without surface tracking. Camera access starts only after tapping Start camera; no microphone, recording, photo storage, or upload is used. Closing the view or leaving the page stops the camera. Hardware camera availability and permission are required.
- A centred handheld device, right-side chores drawer, optional sound, reduced motion, and layouts for modern iPads and phones.

Three creature silhouettes per egg family are followed by repeating renewal forms with new care marks. Daily check-in prompts appear when the app is open; there are no background notifications.

## Saves and timing

Progress is saved in localStorage on the same browser and device. No pet data is sent to an account or server. Different browsers/devices have separate pets; clearing website data removes that browser’s save. Private browsing may discard saves when closed. The earlier hosted account-based version does not transfer progress into this site.

Saved deadlines keep hatch and cocoon countdowns running across reloads. Calendar days use the device’s timezone at adoption; food decay uses elapsed hours. An expired cocoon emerges on the next visit. Writes read the latest saved pet; supported browsers use Web Locks to coordinate tabs. Invalid or unreadable saves are left untouched and reported instead of silently replaced.

Use a current browser; iPadOS/Safari 16.4 or later is recommended.

## Development

Use Node.js 22.13 or later (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the printed local URL with the /remybot/ path.

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

The tests cover lifecycle boundaries, daylight saving, food preferences/decay, chores and moods, persistence, save corruption, storage failures, and competing updates. Production output in dist contains only static HTML, JavaScript, CSS, and artwork. No demo pet or test progress is included.

## Deployment

GitHub Pages publishes the root of the gh-pages branch. The Vite base path is /remybot/ so images and links work at the repository’s Pages address. After running the checks above, commit and push source changes to main, then run npm run deploy to publish the built dist directory. This requires GitHub write access but no custom workflow permissions. The deploy script uses a separate temporary Git index and never force-pushes or modifies source files.

## Source guide

- app/remybot.tsx: interface and interactions
- app/storage.ts: validated, versioned browser saves
- app/engine.ts: lifecycle, food, mood, and check-in rules
- app/play-game.tsx: the two creature games
- app/camera-view.tsx: optional camera overlay and placement controls
- app/eggs.ts and app/lore.json: origins and unlocked stories
- public/sprites, public/moods, public/cocoons: original LCD artwork
- scripts/deploy-pages.mjs: publishes the static build to the gh-pages branch
