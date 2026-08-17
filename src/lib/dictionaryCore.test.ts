import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFINITION_UNAVAILABLE,
  normalizeDictionaryWord,
  parseFreeDictionary,
  parseMerriamWebster,
  stripMerriamMarkup,
} from "../../convex/lib/dictionaryCore.ts";

const GARDEN_FREE_DICT = [
  {
    word: "garden",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition:
              "An outdoor area containing one or more types of plants, usually plants grown for food or ornamental purposes.",
            example: "a vegetable garden",
          },
          {
            definition: "Pubic hair or the genitalia it masks.",
          },
        ],
      },
    ],
  },
];

const ADVENTURE_FREE_DICT = [
  {
    word: "adventure",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition:
              "A feeling of desire for new and exciting experiences.",
            example: "I said it was an adventure, but it was really just a trip.",
          },
        ],
      },
    ],
  },
];

describe("normalizeDictionaryWord", () => {
  it("lowercases and strips edge punctuation", () => {
    assert.equal(normalizeDictionaryWord("Garden,"), "garden");
    assert.equal(normalizeDictionaryWord('"Hello!"'), "hello");
  });

  it("strips possessive endings", () => {
    assert.equal(normalizeDictionaryWord("Tom's"), "tom");
    assert.equal(normalizeDictionaryWord("kids’"), "kids");
  });
});

describe("parseFreeDictionary", () => {
  it("returns the first kid-safe sense for that word", () => {
    const sense = parseFreeDictionary("garden", GARDEN_FREE_DICT);
    assert.ok(sense);
    assert.equal(sense.word, "garden");
    assert.equal(sense.partOfSpeech, "noun");
    assert.match(sense.definition, /outdoor area containing/i);
    assert.equal(sense.example, "a vegetable garden");
    assert.equal(sense.source, "dictionaryapi.dev");
  });

  it("does not use an adult later sense as the definition", () => {
    const sense = parseFreeDictionary("garden", GARDEN_FREE_DICT);
    assert.ok(sense);
    assert.doesNotMatch(sense.definition, /pubic|genitalia/i);
  });

  it("gives different definitions for different words", () => {
    const garden = parseFreeDictionary("garden", GARDEN_FREE_DICT);
    const adventure = parseFreeDictionary("adventure", ADVENTURE_FREE_DICT);
    assert.ok(garden);
    assert.ok(adventure);
    assert.notEqual(garden.definition, adventure.definition);
    assert.doesNotMatch(garden.definition, /is a word you can learn/i);
    assert.doesNotMatch(adventure.definition, /is a word you can learn/i);
  });

  it("refuses another word's payload", () => {
    const sense = parseFreeDictionary("axle", GARDEN_FREE_DICT);
    assert.equal(sense, null);
  });

  it("does not treat a short word as a prefix of a longer one", () => {
    assert.equal(parseFreeDictionary("a", ADVENTURE_FREE_DICT), null);
  });

  it("accepts a simple plural of the same headword", () => {
    const sense = parseFreeDictionary("gardens", GARDEN_FREE_DICT);
    assert.ok(sense);
    assert.match(sense.definition, /outdoor area containing/i);
  });

  it("prefers the common sense when an obscure short sense is listed first", () => {
    const axle = [
      {
        word: "axle",
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [{ definition: "Shoulder." }],
          },
        ],
      },
      {
        word: "axle",
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [
              {
                definition:
                  "The pin or spindle on which a wheel revolves, or which revolves with a wheel.",
              },
            ],
          },
        ],
      },
    ];
    const sense = parseFreeDictionary("axle", axle);
    assert.ok(sense);
    assert.match(sense.definition, /wheel/i);
    assert.doesNotMatch(sense.definition, /^shoulder/i);
  });

  it("returns null for missing or empty payloads", () => {
    assert.equal(parseFreeDictionary("garden", { title: "No Definitions Found" }), null);
    assert.equal(parseFreeDictionary("garden", []), null);
  });
});

describe("parseMerriamWebster", () => {
  it("uses the first short definition for the requested word", () => {
    const sense = parseMerriamWebster("garden", [
      {
        meta: { id: "garden:1", stems: ["garden", "gardens"] },
        fl: "noun",
        shortdef: [
          "a plot of ground where herbs, fruits, flowers, or vegetables are cultivated",
        ],
      },
    ]);
    assert.ok(sense);
    assert.equal(sense.word, "garden");
    assert.equal(sense.partOfSpeech, "noun");
    assert.match(sense.definition, /plot of ground/i);
    assert.equal(sense.source, "merriam-webster");
  });

  it("returns null for suggestion lists when the word is unknown", () => {
    assert.equal(
      parseMerriamWebster("xyzzy", ["xylyl", "xyster"]),
      null,
    );
  });

  it("strips Webster markup from definitions", () => {
    assert.equal(
      stripMerriamMarkup("{bc}a {a_link|plot} of ground"),
      "a plot of ground",
    );
  });
});

describe("unavailable copy", () => {
  it("is an honest failure message, not a fake definition", () => {
    assert.equal(DEFINITION_UNAVAILABLE, "Definition unavailable");
  });
});
