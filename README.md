# Remybot

[Play Remybot](https://bomjacques.github.io/remybot/)

An LCD virtual pet with simple daily chores, built for children aged 6–9. Runs entirely in the browser on GitHub Pages using React, TypeScript, and Vite. No login, GPT, AI service, API key, database, or application backend is required.

## Play

Choose one of twelve mystery eggs and give your companion a name. The first egg hatches in 60 seconds, with an LCD countdown and filling meter. Metamorphosis unlocks every new calendar day, with an entering animation, a 60-second cocoon, and an emergence animation. Existing saves retain their pet and can catch up to the new daily schedule.

- Three default chores: Put shoes away, Brush teeth, Empty lunch box. Edit them or add up to six.
- Incomplete chores produce a sad expression; completing them produces a happy one. Hunger and sleep take priority.
- Feed garden bowls, apples, and star biscuits. Each creature has its own food likes and dislikes. One tummy block fades every eight hours; pets never die or lose growth from hunger.
- Daily care is hands-on: brush back and forth to fill the teeth meter; scrub every soap spot and rinse; stroke or pat the creature; feed a bite when the rhythm marker crosses the middle. Each crossing allows one bite. Keyboard alternatives and a slower feeding pace are included.
- Brushing, washing and patting each earn one care XP on their first completion per local day. Every five XP increases care mastery; activity difficulty grows gently through five challenge settings. These activities do not mark the child's real-world chores complete.
- Bedtime has a blanket slider and Lights out button for eight hours of sleep. A 20-minute nap and early wake-up are also available. Sleep and daily care persist when the app is closed.
- Read each creature’s story and care guide after it hatches. Food, chores, cuddles, and naps shape the experience.
- Drag the creature around the LCD screen, or use arrow keys and Home to centre him. Tap to make him laugh. The Play button opens Catch the stars and Copy my moves, with separate saved levels. Star-catching grows from five to twelve stars and introduces movement; memory patterns grow up to six moves with faster cues. Each game creates fresh positions or patterns. There is no failure timer, and memory patterns can be replayed.
- Open the Toy box for a bouncing ball and poppable bubbles. These are free-play activities with creature reactions. Games and toys never complete chores for you.
- Friends opens a playdate: invite up to two hatchling visitors or earlier companions from the family album. They appear beside your pet on the LCD and in camera view. Pass a ball between them three times to finish a play step, or make the group dance. Visitors do not replace the active pet or need their own care; no account or online connection to another player is involved.
- Snack snake is the third game. Collect apples with a growing pixel snake while your companion cheers. Steer with touch arrows, swipes or keyboard arrows/WASD. The edges wrap around; bumping your own tail offers a retry. Six levels gradually increase the apple goal and speed, with a slower pace option, pause/resume and automatic pause when the page is hidden. Winning advances its own saved level and earns the adventure play step.
- Each family has a five-chapter adventure. One care activity or completed game/toy round earns the first keepsake choice; subsequent chapters need both care and play, in either order. A new discovered form opens each chapter. Choose one of two pixel decorations per chapter and display any earned item on the LCD. Unfinished progress persists without daily resets, streaks or penalties. Three ball tosses or six bubbles finish a toy round; free play can continue afterward.
- Camera view places the LCD creatures over a live camera picture. Drag them around, resize them, and tap to interact. This is a 2D camera overlay, without surface tracking. Take photo captures the visible frame and creatures into a local PNG preview, then stops the camera. Share / save photo opens the device's share sheet when file sharing is supported; on iPad, use its Save Image option when offered. PNG download and pressing and holding the preview provide alternatives. Browsers cannot silently write to the camera roll. Retake discards the preview. No microphone, video recording or automatic upload is used; sharing happens only through a destination the player chooses. Closing the view or leaving the page stops the camera. Hardware camera availability and permission are required.
- A centred handheld device, right-side chores drawer, optional sound, reduced motion, and layouts for modern iPads and phones.
- Reset in the bottom menu asks for confirmation before clearing this browser’s companion and returning to egg selection.
- Family album offers an optional next generation after seven local calendar days and two completed cocoons. Continue the same egg family or choose any other family without resetting. The previous companion's full forms, check-ins, care history and keepsakes stay archived. Game levels, care mastery and custom chores carry forward; the new egg has a fresh adventure, fresh daily care and a small inherited pixel feature. Companions never die, and starting a new generation is never automatic.

Five creature silhouettes per egg family are followed by alternating fourth/fifth renewal forms with care marks. The twelve families are Moss, Luna, Ember, Tide, Static, Relic, Nimbus, Pebble, Dusk, Coral, Glint and Tinker. Every family has its own egg, cocoon, five-stage LCD artwork, mood expressions, food preferences and five-chapter adventure. The growth history shows discovered forms and keeps future forms hidden. Artwork advances with each completed cocoon, including after missed days, so consecutive emergences show different forms. Existing companions keep the artwork of all previously completed forms, then discover the added forms in order. Daily check-in prompts appear when the app is open; there are no background notifications.

## Gameplay review

The October 2026 GUI review covered first adoption, hatching, care, games, chores, bedtime, later forms and the next generation. The main gap was a reward beyond routine maintenance. The adventure loop now connects those actions to a visible choice and an ongoing family story.

Benchmarks included [Tamagotchi Adventure Kingdom](https://apps.apple.com/us/app/tamagotchi-adventure-kingdom/id1614952689) (US App Store 4.8/5, about 12K ratings), [My Tamagotchi Forever](https://apps.apple.com/us/app/my-tamagotchi-forever/id1267861706) (4.6/5, about 28K), [My Talking Tom 2](https://apps.apple.com/us/app/my-talking-tom-2/id1337578317) (4.4/5, about 858K), and [Pou](https://apps.apple.com/us/app/pou/id575154654?platform=ipad) (4.4/5, about 3.9K), checked 7 October 2026. Their documented discovery, customization and collection loops informed this design; ratings are not evidence that a particular child will enjoy Remybot.

A short observed playtest with ages 6–9 should check whether a child can find the next action unaided, understand the earned decoration, choose an activity while the pet is full, and decide what to return for tomorrow. No children were included in the automated or GUI audit.

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
- app/play-game.tsx: game selection, stars and memory games
- app/snake-game.tsx and app/snake-rules.ts: LCD Snake interface and movement rules
- app/game-rules.ts: difficulty levels and random game layouts
- app/toy-box.tsx: ball and bubble interactions
- app/playdate.tsx and app/playmates.ts: visitor selection, shared ball play and LCD friends
- app/care-hub.tsx: daily care dashboard, blanket and bedtime controls
- app/care-activity.tsx and app/care-rules.ts: gesture activities and rhythm feeding
- app/family-album.tsx and app/creature-appearance.tsx: generations and inherited LCD features
- app/draggable-creature.tsx: bounded touch, mouse, and keyboard movement
- app/camera-view.tsx: optional camera overlay and placement controls
- app/camera-photo.ts: local photo composition and preview helpers
- app/evolution-path.tsx: five-form discovery tracker with hidden future artwork
- app/adventure.tsx and app/adventure-content.ts: next action, family story chapters and collectible LCD decorations
- app/eggs.ts and app/lore.json: origins and unlocked stories
- public/sprites, public/moods, public/cocoons: original LCD artwork
- scripts/deploy-pages.mjs: publishes the static build to the gh-pages branch
