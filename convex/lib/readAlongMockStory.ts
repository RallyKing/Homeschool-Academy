export type MockReadAlongAgeBand =
  | "early_elementary"
  | "elementary"
  | "middle"
  | "teen"
  | "mixed";

export function mockReadAlongStory(args: {
  displayName: string;
  ageBand: MockReadAlongAgeBand;
  academicLevel?: string;
  subject?: string;
  recipeTitle?: string;
}): { title: string; body: string } {
  const name = args.displayName.split(" ")[0] || "Sam";
  const topic = args.subject?.trim() || "everyday adventure";
  const recipeTitle = args.recipeTitle?.trim();

  if (recipeTitle) {
    return {
      title: recipeTitle,
      body: recipeMockBody({ name, topic, recipeTitle, ageBand: args.ageBand }),
    };
  }

  if (args.ageBand === "early_elementary") {
    return {
      title: `${name} and the Red Ball`,
      body: `${name} had a small red ball. The ball sat on the mat. ${name} gave it a tap. Tap, tap, tap! The ball rolled to the cat. The cat gave it a pat. Then the ball rolled to the sunlit path. ${name} ran and got the ball. "I did it!" said ${name}. The cat sat. The ball was still. It was a good, quiet day to play and rest.`,
    };
  }

  if (args.ageBand === "elementary") {
    return {
      title: `The Garden Map`,
      body: `${name} found a folded paper in the kitchen drawer. It was a map of the backyard garden, with a tiny X by the old oak. After lunch, ${name} followed the path past tomatoes, mint, and a sleepy bee. Under a flat stone by the oak, there was a tin box. Inside was a note: "Leave something kind for the next explorer." ${name} drew a picture of the garden, tucked it in the tin box, and put the stone back. The topic of ${topic} could wait. Today was for noticing.`,
    };
  }

  if (args.ageBand === "middle") {
    return {
      title: `Signals on the Creek`,
      body: `${name} tested a homemade water wheel at the creek behind the house. The first try jammed on a stick. The second spun, then wobbled. ${name} sketched the problem, swapped a smoother axle, and tried again. Neighbors walking dogs paused to watch. "It's for a ${topic} project," ${name} explained, "but mostly I wanted to see if it would work." When the wheel finally turned steadily, ${name} logged the time, the materials, and one honest sentence: failure taught the next step. Then ${name} packed up so the creek could keep its quiet.`,
    };
  }

  return {
    title: `A Quiet Hypothesis`,
    body: `${name} wanted a ${topic} essay that did not sound like a race against anyone else. So ${name} spent a morning collecting small facts: how long the bread took to rise, which pages of the lab notebook were actually useful, and what the family garden taught about patience. The draft began with a question, not a boast. Evidence came next, then a limitation: one backyard is not the whole world. By evening ${name} had a piece that a parent could discuss at the table — curious, careful, and finished without comparing siblings. That was the real experiment.`,
  };
}

function recipeMockBody(input: {
  name: string;
  topic: string;
  recipeTitle: string;
  ageBand: MockReadAlongAgeBand;
}): string {
  const { name, topic, recipeTitle, ageBand } = input;
  const themeLine =
    topic.toLowerCase() !== recipeTitle.toLowerCase()
      ? ` The story was about ${topic}.`
      : "";

  if (ageBand === "early_elementary") {
    return `${name} read a story called ${recipeTitle}.${themeLine} ${name} sat on the mat with a tin box of crayons. ${name} drew a kind picture, then shared it. "I can help," said ${name}. It was a good, quiet day.`;
  }

  if (ageBand === "middle" || ageBand === "teen") {
    return `${name} chose the recipe “${recipeTitle}”.${themeLine} After lunch, ${name} picked up a tin box of notes and tried one small kind action, then another. A sleepy bee hummed by the window. ${name} wrote what worked, put the tin box back, and left the next explorer a fair chance too.`;
  }

  return `${name} opened a story called ${recipeTitle}.${themeLine} After lunch, ${name} picked up a tin box of crayons and sat by the window. ${name} tried one kind action, then another. A sleepy bee hummed in the garden. ${name} tucked a note in the tin box for the next explorer: notice, help, and share.`;
}
