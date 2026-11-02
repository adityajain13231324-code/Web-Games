// Original, hand-curated sound ideas. Pipe separates conservative accepted aliases.
const everyday = [
  "Kettle|tea kettle|boiling kettle",
  "Zipper|zip",
  "Helicopter|chopper",
  "Snoring|snore",
  "Doorbell|door bell",
  "Alarm clock|alarm",
  "Telephone ringing|phone ringing",
  "Vacuum cleaner|vacuum",
  "Hair dryer|blow dryer",
  "Electric toothbrush|toothbrush",
  "Blender|mixer",
  "Microwave|microwave oven",
  "Toaster|toast popping",
  "Washing machine|washer",
  "Printer|printing",
  "Keyboard|typing",
  "Camera shutter|camera",
  "Stapler|stapling",
  "Scissors|cutting paper",
  "Paper tearing|ripping paper",
  "Bubble wrap|popping bubble wrap",
  "Soda can opening|opening a can",
  "Pouring water|water pouring",
  "Dripping tap|dripping faucet",
  "Flushing toilet|toilet flushing",
  "Brushing teeth|teeth brushing",
  "Gargling|gargle",
  "Sneezing|sneeze",
  "Coughing|cough",
  "Hiccups|hiccup",
  "Yawning|yawn",
  "Sighing|sigh",
  "Laughing|laughter",
  "Crying|sobbing",
  "Kissing|kiss",
  "Chewing|eating",
  "Slurping noodles|slurping",
  "Stomach rumbling|growling stomach",
  "Heartbeat|heart beat",
  "Footsteps|walking",
  "Knocking on a door|knocking",
  "Creaking door|door creak",
  "Slamming door|door slam",
  "Keys jingling|keys",
  "Coins falling|coins",
  "Velcro|velcro ripping",
  "Striking a match|lighting a match",
  "Spray bottle|spraying",
  "Wiping a window|cleaning glass",
  "Scrubbing a pan|scrubbing",
  "Squeaky shoe|squeaking shoe",
  "Bouncing ball|ball bouncing",
  "Whistle|whistling",
  "Hand clap|clapping",
  "Finger snap|snapping fingers",
  "Drum roll|drumroll",
  "Guitar strum|guitar",
  "Trumpet|horn instrument",
  "Violin|fiddle",
  "Cymbal crash|cymbals",
];
const nature = [
  "Dog barking|barking|dog",
  "Cat meowing|meow|cat",
  "Cow mooing|moo|cow",
  "Sheep bleating|baa|sheep",
  "Pig oinking|oink|pig",
  "Horse neighing|neigh|horse",
  "Donkey braying|donkey",
  "Rooster crowing|rooster",
  "Chicken clucking|chicken",
  "Duck quacking|duck",
  "Goose honking|goose",
  "Owl hooting|owl",
  "Crow cawing|crow",
  "Pigeon cooing|pigeon",
  "Parrot squawking|parrot",
  "Seagull|sea gull",
  "Woodpecker|wood pecker",
  "Lion roaring|lion",
  "Tiger growling|tiger",
  "Elephant trumpeting|elephant",
  "Monkey chattering|monkey",
  "Wolf howling|wolf",
  "Snake hissing|snake",
  "Frog croaking|frog",
  "Cricket chirping|cricket",
  "Bee buzzing|bee",
  "Mosquito|mosquito buzzing",
  "Dolphin clicking|dolphin",
  "Whale singing|whale",
  "Seal barking|seal",
  "Thunder|thunderstorm",
  "Heavy rain|rain",
  "Wind howling|wind",
  "Ocean waves|waves|ocean",
  "Stream|brook|flowing river",
  "Waterfall|water fall",
  "Fire crackling|fire",
  "Leaves rustling|leaves",
  "Crunching snow|walking in snow",
  "Walking on gravel|gravel",
  "Ice cracking|cracking ice",
  "Volcano erupting|volcano",
  "Bubbling mud|mud bubbles",
  "Pebble splashing|splash",
  "Dripping cave|cave dripping",
];
const machines = [
  "Car engine|engine revving",
  "Car horn|honking car",
  "Car brakes|brakes screeching",
  "Motorcycle|motorbike",
  "Steam train|steam engine",
  "Train whistle|train horn",
  "Airplane|aeroplane|plane",
  "Rocket launch|rocket",
  "UFO|spaceship",
  "Submarine sonar|sonar",
  "Siren|emergency siren",
  "Ambulance|ambulance siren",
  "Fire truck|fire engine",
  "Police car|police siren",
  "Bicycle bell|bike bell",
  "Skateboard|skateboarding",
  "Rowing boat|rowing",
  "Speedboat|motor boat",
  "Ship horn|foghorn",
  "Tractor|farm tractor",
  "Lawn mower|lawnmower",
  "Chainsaw|chain saw",
  "Electric drill|drill",
  "Jackhammer|pneumatic drill",
  "Hammering|hammer",
  "Sawing wood|saw",
  "Elevator|lift",
  "Cash register|till",
  "Video game laser|laser",
  "Robot walking|walking robot",
];
// Components accumulate privately across guesses. Each group contains accepted synonyms.
const scenes = [
  ["Robot with hiccups", ["robot"], ["hiccup", "hiccups"]],
  [
    "Car refusing to start",
    ["car", "engine"],
    ["not starting", "wont start", "refusing", "broken"],
  ],
  ["Mosquito near your ear", ["mosquito"], ["ear", "near"]],
  ["Nervous ghost", ["ghost"], ["nervous", "scared", "frightened"]],
  ["Dog in a thunderstorm", ["dog"], ["thunder", "storm", "thunderstorm"]],
  ["Cat on a motorcycle", ["cat"], ["motorcycle", "motorbike"]],
  ["Sleeping dragon", ["dragon"], ["sleeping", "snoring", "asleep"]],
  ["Robot falling down stairs", ["robot"], ["stairs", "falling"]],
  ["Dinosaur sneezing", ["dinosaur", "dino"], ["sneeze", "sneezing"]],
  ["Whale at the dentist", ["whale"], ["dentist", "dental"]],
  ["Alien eating noodles", ["alien"], ["noodles", "slurping"]],
  ["Duck learning to sing", ["duck"], ["sing", "singing"]],
  ["Cow on a roller coaster", ["cow"], ["roller coaster", "rollercoaster"]],
  ["Ghost with a cold", ["ghost"], ["cold", "cough", "sneezing"]],
  ["Tiny angry lion", ["lion"], ["tiny", "small"], ["angry", "mad"]],
  ["Elephant tiptoeing", ["elephant"], ["tiptoeing", "tiptoe", "quiet"]],
  ["Opera singing frog", ["frog"], ["opera", "singing"]],
  ["Robot laughing", ["robot"], ["laugh", "laughing"]],
  ["Cat stuck in a box", ["cat"], ["box", "stuck"]],
  ["Pig playing trumpet", ["pig"], ["trumpet"]],
  ["Horse wearing squeaky shoes", ["horse"], ["squeaky", "shoes"]],
  ["Monkey brushing teeth", ["monkey"], ["teeth", "brushing"]],
  ["Penguin slipping on ice", ["penguin"], ["slipping", "ice"]],
  ["Bear tasting hot soup", ["bear"], ["hot", "soup"]],
  ["Chicken driving a race car", ["chicken"], ["car", "racing"]],
  ["Dragon blowing birthday candles", ["dragon"], ["candles", "birthday"]],
  ["Dog chasing a bouncing ball", ["dog"], ["ball", "bouncing"]],
  ["Sleepy robot alarm clock", ["robot"], ["alarm"]],
  [
    "Spaceship with a flat tire",
    ["spaceship", "ufo"],
    ["flat", "tire", "tyre"],
  ],
  ["Kettle launching into space", ["kettle"], ["space", "launching"]],
];
const modes = ["classic", "gartic", "duo", "detective", "foley", "ranking"];

// Words that are too weak to count as a guess on their own ("of", "hot", "voice").
const FILLER = new Set(
  "of the a an and in on at to for with by from up out off is it can will".split(
    " ",
  ),
);
const MODIFIERS = new Set(
  `dramatic fake heavy loud sloppy sultry seductive flirty naughty guilty cheeky sexy romantic smooth slow big little small old new hot cold
  red blue green black white golden silver giant mini super great grand tiny happy sad angry crazy mad wild baby sweet pleasure creaky squeaky
  yellow pink purple orange grey gray dark light brown fried mount fresh
  bedroom electric sound noise noises voice song music`.split(/\s+/),
);
/**
 * Extra things a guesser might say for a one- or two-word prompt, so guessing is not a chore:
 * each meaningful word alone ("whisper" for "Sultry Whisper"), and the words run together ("catcall" for "Cat Call").
 * Hyphenated words split apart ("Walk-Of-Shame") unless they are names ("Spider-Man", splitHyphens off).
 * With lastOnly (famous people, characters) only the final word counts.
 */
export function autoAliases(
  phrase,
  { lastOnly = false, splitHyphens = false } = {},
) {
  const units = String(phrase)
    .trim()
    .split(splitHyphens ? /[\s-]+/ : /\s+/);
  const out = new Set();
  const usable = (n) => n.length >= 3 && !FILLER.has(n) && !MODIFIERS.has(n);
  if (units.length >= 2 && units.length <= 4) {
    const pool = lastOnly ? units.slice(-1) : units;
    for (const unit of pool) {
      const n = normalize(unit);
      if (usable(n)) out.add(n);
    }
    if (!lastOnly && units.length === 2) {
      const joined = units.map(normalize).join("");
      if (joined.length >= 5) out.add(joined);
    }
  }
  const whole = normalize(phrase);
  out.delete(whole);
  return [...out];
}
export const prompts = [
  ...[
    ...everyday.map((s) => [s, "Everyday"]),
    ...nature.map((s) => [s, "Wild world"]),
    ...machines.map((s) => [s, "Machines"]),
  ].map(([s, category], i) => {
    const [phrase, ...aliases] = s.split("|");
    return {
      id: `sound-${i + 1}`,
      phrase,
      category,
      difficulty: "easy",
      aliases: [
        ...new Set([
          phrase,
          ...aliases,
          ...autoAliases(phrase, { splitHyphens: true }),
        ]),
      ],
      components: [],
      hints: [
        category,
        `${phrase.split(" ").length} word${phrase.includes(" ") ? "s" : ""}`,
      ],
      modes: modes.filter((m) => m !== "duo"),
    };
  }),
  ...scenes.map(([phrase, ...components], i) => ({
    id: `scene-${i + 1}`,
    phrase,
    category: "Odd little scenes",
    difficulty: "hard",
    aliases: [phrase],
    components,
    hints: ["An unlikely situation", `${components.length} things to discover`],
    modes,
  })),
];

export function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] !== b[j - 1]));
      prev = old;
    }
  }
  return d[b.length];
}
/** Rough word stem so "moaning", "moans" and "moan" count as the same word. */
function stem(word) {
  let w = word;
  const cut = (n) => (w.length - n >= 3 ? w.slice(0, -n) : w);
  if (w.endsWith("ing")) w = cut(3);
  else if (w.endsWith("ies")) w = w.length > 4 ? `${w.slice(0, -3)}y` : w;
  else if (w.endsWith("es") && w.length > 4) w = cut(2);
  else if (w.endsWith("ed") && w.length > 4) w = cut(2);
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = cut(1);
  if (w.endsWith("e") && w.length > 3) w = w.slice(0, -1);
  if (w.length > 3 && w.at(-1) === w.at(-2) && !"aeiou".includes(w.at(-1)))
    w = w.slice(0, -1);
  return w;
}
function accepts(guess, alias) {
  const a = normalize(alias);
  const g = normalize(guess);
  if (` ${g} `.includes(` ${a} `)) return true;
  // A single typo only on a whole candidate of at least five characters.
  if (
    a.length >= 5 &&
    Math.abs(g.length - a.length) <= 1 &&
    distance(g, a) <= 1
  )
    return true;
  // Same words in another form: "moan" for "moaning", "lions" for "lion".
  const at = a.split(" ").map(stem);
  const gt = g.split(" ").map(stem);
  for (let i = 0; i + at.length <= gt.length; i++)
    if (at.every((t, j) => t === gt[i + j])) return true;
  return false;
}
export function matchPrompt(prompt, guess, previous = []) {
  const full = prompt.aliases.some((a) => accepts(guess, a));
  const components = prompt.components
    .map((aliases, i) =>
      previous.includes(i) || aliases.some((a) => accepts(guess, a)) ? i : -1,
    )
    .filter((i) => i >= 0);
  return {
    correct:
      full ||
      (prompt.components.length > 0 &&
        components.length === prompt.components.length),
    components,
    total: prompt.components.length,
  };
}
