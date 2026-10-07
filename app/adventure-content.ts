export interface AdventureChapter {
  title: string;
  prompt: string;
  discovery: string;
}

export interface Adventure {
  title: string;
  chapters: AdventureChapter[];
}

export type KeepsakeId = 'leaf' | 'flower' | 'moon' | 'star' | 'kite' | 'flag' | 'pond' | 'shell' | 'lamp' | 'beacon';

export interface Keepsake {
  id: KeepsakeId;
  name: string;
  chapter: 0 | 1 | 2 | 3 | 4;
  shape: KeepsakeId;
}

export const keepsakes: Keepsake[] = [
  {id: 'leaf', name: 'Little leaf', chapter: 0, shape: 'leaf'},
  {id: 'flower', name: 'Wildflower', chapter: 0, shape: 'flower'},
  {id: 'moon', name: 'Paper moon', chapter: 1, shape: 'moon'},
  {id: 'star', name: 'Pocket star', chapter: 1, shape: 'star'},
  {id: 'kite', name: 'Tiny kite', chapter: 2, shape: 'kite'},
  {id: 'flag', name: 'Trail flag', chapter: 2, shape: 'flag'},
  {id: 'pond', name: 'Pebble pond', chapter: 3, shape: 'pond'},
  {id: 'shell', name: 'Stripy shell', chapter: 3, shape: 'shell'},
  {id: 'lamp', name: 'Camp lamp', chapter: 4, shape: 'lamp'},
  {id: 'beacon', name: 'Little beacon', chapter: 4, shape: 'beacon'},
];

// Egg order: Moss, Luna, Ember, Tide, Static, Relic, Nimbus, Pebble.
// Each chapter follows one discovered form. Its keepsake is the player's choice.
export const adventures: Adventure[] = [
  {
    title: 'The Pocket Garden',
    chapters: [
      {title: 'An empty patch', prompt: 'Moss has found a bare patch beside an old tree. Our pocket garden starts here.', discovery: 'Moss clears a circle in the soil. A beetle checks the edge, then settles in to watch.'},
      {title: 'A garden after dark', prompt: 'Moss wonders what the garden will look like at night. Plan a sky-watching corner.', discovery: 'Moss marks a spot with a clear view of the sky. No branches in the way, and room for two.'},
      {title: 'Which way in?', prompt: 'The garden needs an entrance. Moss wants visitors to find it without getting lost.', discovery: 'A winding path now reaches the garden. The beetle walks it twice, just to check.'},
      {title: 'Room for a puddle', prompt: 'Rain is coming. Moss has a plan for a little water corner beside the path.', discovery: 'Rain fills the water corner. Moss counts three ripples and one very surprised ant.'},
      {title: 'Opening night', prompt: 'The pocket garden is ready. Help Moss finish its first evening welcome.', discovery: 'The garden opens after sunset. Moss gives the beetle a tour, starting with the best sitting spot.'},
    ],
  },
  {
    title: 'The Skywatch Club',
    chapters: [
      {title: 'A place to look up', prompt: 'Luna is starting a skywatch club. First, it needs a quiet place with a clear view.', discovery: 'Luna finds a grassy lookout. The club has one rule: no standing in front of the telescope.'},
      {title: 'An upside-down map', prompt: 'Luna has drawn a sky map, but something is upside down. The club can sort it out.', discovery: 'Luna turns the map around. That is better. The large smudge turns out to be a biscuit crumb.'},
      {title: 'A windy lookout', prompt: 'A breeze keeps lifting the club notes. Luna needs a way to spot windy nights.', discovery: 'Luna adds a wind check to the club notes. Tonight is breezy enough to need a paperweight.'},
      {title: 'A second sky', prompt: 'Luna has spotted the sky reflected in water. The club has a new mystery to study.', discovery: 'Luna compares the sky with its reflection. A tiny splash makes the whole upside-down sky wobble.'},
      {title: 'The first skywatch', prompt: 'The lookout and notes are ready. Finish the club setup for its first night.', discovery: 'Luna opens the skywatch club. Tonight\'s report: two bright dots, one passing moth and no missing biscuits.'},
    ],
  },
  {
    title: 'The Camp Theatre',
    chapters: [
      {title: 'A stage of our own', prompt: 'Ember wants to put on a camp show. Every theatre needs a stage, even a tiny one.', discovery: 'Ember marks out a stage beside the camp. The first rehearsal is a very dramatic sneeze.'},
      {title: 'A night-time show', prompt: 'Ember has picked a story about a lost astronaut. Help set the scene for the show.', discovery: 'Ember practises floating through space. A cardboard box makes an excellent pretend spaceship.'},
      {title: 'The grand entrance', prompt: 'The audience needs to find the theatre. Ember is planning a grand entrance.', discovery: 'Ember tests the entrance with a bow, a spin and another bow. The show might need fewer bows.'},
      {title: 'Make some rain', prompt: 'The story needs a rainstorm. Ember is working on a sound effect without getting the stage wet.', discovery: 'Ember taps a tin to make pretend rain. A gentle shower becomes a noisy storm, then stops on cue.'},
      {title: 'Curtain up', prompt: 'The stage is set and the sound effects are ready. It is time for the camp show.', discovery: 'Ember performs the whole space story. The landing is bumpy, the audience laughs, and nobody forgets their lines.'},
    ],
  },
  {
    title: 'The Puddle Post',
    chapters: [
      {title: 'Our first post stop', prompt: 'Tide wants to reopen the puddle post. Start with a small stop for letters beside the water.', discovery: 'Tide sets out a post tray. The first letter is addressed to Whoever Lives Under That Large Rock.'},
      {title: 'The night address', prompt: 'A letter is marked for delivery after dark. Tide needs a picture to remember the address.', discovery: 'Tide adds the night address to the route book. The rock resident turns out to be a very sleepy snail.'},
      {title: 'A route to remember', prompt: 'Three puddles look almost the same. Tide is making the post route easier to follow.', discovery: 'Tide marks each stop in the route book. No more delivering the snail\'s letters to an empty flowerpot.'},
      {title: 'Across the water', prompt: 'One post stop is on the far side of a puddle. Tide has an idea for a pretend ferry.', discovery: 'Tide tests a leaf-sized ferry in the story. The letters arrive dry; the captain gets one wet foot.'},
      {title: 'The evening round', prompt: 'The route book is complete. Get the puddle post ready for its first evening round.', discovery: 'Tide finishes the round and checks the tray. Every letter is delivered, including a postcard from the snail.'},
    ],
  },
  {
    title: 'The Backyard Radio',
    chapters: [
      {title: 'Find our studio', prompt: 'Static wants to make a pretend radio show. A corner of the backyard will be the studio.', discovery: 'Static sets up the studio. The microphone test picks up a chirp, a burp and someone moving a chair.'},
      {title: 'The night report', prompt: 'The radio show needs a night-sky report. Static is preparing the first few lines.', discovery: 'Static writes the report: sky above, ground below. Accurate, but there may be room for more detail.'},
      {title: 'Test the signal', prompt: 'The pretend broadcast keeps turning into a squeak. Static is checking the studio signal.', discovery: 'Static turns a dial and the squeak stops. A clear beep rings out. That sounds much more like a radio.'},
      {title: 'The puddle beat', prompt: 'Static needs a tune for the show. Drips from the garden tap might make a good beat.', discovery: 'Static copies the drip rhythm: plip, plop, pause. A passing bird joins in exactly one beat late.'},
      {title: 'On the air', prompt: 'The report, signal and tune are ready. Finish the studio for its first pretend broadcast.', discovery: 'Static starts the backyard show with a weather report, a puddle tune and a joke about a very confused toaster.'},
    ],
  },
  {
    title: 'The Tiny Museum',
    chapters: [
      {title: 'A door to somewhere', prompt: 'Relic has found an old door with no walls. Imagine a tiny museum on the other side.', discovery: 'Relic draws a museum around the door. The first display has a label, a shelf and plenty of space.'},
      {title: 'A sky mystery', prompt: 'A sketch of the night sky belongs in the museum. Relic is working out what its marks mean.', discovery: 'Relic studies the sketch. Some marks follow the sky; the largest one is probably an old thumbprint.'},
      {title: 'The explorer room', prompt: 'The next museum room is about journeys. Relic needs a display that points the way.', discovery: 'Relic arranges the explorer room. A line on the floor leads visitors around instead of straight into a cupboard.'},
      {title: 'The water room', prompt: 'Relic wants a room about streams and seas. Even a tiny museum can hold a big idea.', discovery: 'The water room gets its first story: how a stone travels down a stream, one bump at a time.'},
      {title: 'Museum opening', prompt: 'All the rooms have a story. Finish the museum so Relic can welcome its first visitors.', discovery: 'Relic opens the old door. Inside the imagined museum, every shelf now has something worth stopping to see.'},
    ],
  },
  {
    title: 'The Weather Lookout',
    chapters: [
      {title: 'A place for weather', prompt: 'Nimbus wants a weather lookout. First, it needs a spot where the breeze can reach.', discovery: 'Nimbus chooses a clear patch by the fence. The first weather report is short: definitely outside.'},
      {title: 'Watching after dark', prompt: 'Weather does not stop at sunset. Nimbus is adding a page for clear and cloudy nights.', discovery: 'Nimbus records a clear patch between two clouds. The clouds move before the drawing is finished.'},
      {title: 'Which way is windy?', prompt: 'The breeze keeps changing its mind. Nimbus wants a marker to show which way it blows.', discovery: 'Nimbus checks the breeze from the lookout. Left, then right, then straight through a pile of notes.'},
      {title: 'The rain report', prompt: 'A shower is on the way. Nimbus is planning a place to watch the raindrops land.', discovery: 'Nimbus listens to the shower. Small drops patter; one enormous drop lands with a plonk.'},
      {title: 'Forecast finished', prompt: 'Wind, rain and night reports are ready. Finish the lookout for its first full forecast.', discovery: 'Nimbus announces the forecast: breezy, then drizzly, with a strong chance of muddy footprints.'},
    ],
  },
  {
    title: 'The Streamside Trail',
    chapters: [
      {title: 'The first stepping spot', prompt: 'Pebble is planning an imaginary trail beside a stream. Pick a starting point for the route.', discovery: 'Pebble marks the first stepping spot. It is flat, steady and definitely a stone rather than a potato.'},
      {title: 'A place to pause', prompt: 'Every trail needs a rest stop. Pebble has found a spot with a view of the evening sky.', discovery: 'Pebble adds a rest stop to the plan. There is room to sit, count clouds and inspect muddy toes.'},
      {title: 'A clear direction', prompt: 'The trail splits beside a tree. Pebble wants walkers to know which way the route goes.', discovery: 'Pebble draws a clear turning point. The beetle testing the route gets it right on the first try.'},
      {title: 'Over the stream', prompt: 'The last gap crosses the stream. Pebble is planning a set of pretend stepping stones.', discovery: 'Pebble checks each stepping stone in the plan. Small gaps, flat tops and no wobbly middle one.'},
      {title: 'The trail is ready', prompt: 'The route now reaches the other bank. Help Pebble finish its streamside trail.', discovery: 'Pebble follows the finished route in the story. The beetle comes too, carrying a picnic much larger than expected.'},
    ],
  },
];
