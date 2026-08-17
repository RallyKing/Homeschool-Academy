import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUser, requireRole } from "./lib/auth";
import {
  normalizeDictionaryWord,
  parseFreeDictionary,
  parseMerriamWebster,
  websterKeyFromEnv,
  type DictionarySense,
  type DictionarySource,
} from "./lib/dictionaryCore";
import {
  dictionaryEntryDocValidator,
  dictionarySourceValidator,
} from "./lib/validators";

const LIST_LIMIT = 100;

const lookupResultValidator = v.object({
  word: v.string(),
  definition: v.union(v.string(), v.null()),
  example: v.union(v.string(), v.null()),
  partOfSpeech: v.union(v.string(), v.null()),
  source: v.union(
    dictionarySourceValidator,
    v.literal("unavailable"),
  ),
});

type LookupResult = {
  word: string;
  definition: string | null;
  example: string | null;
  partOfSpeech: string | null;
  source: DictionarySource | "unavailable";
};

function unavailableResult(word: string): LookupResult {
  return {
    word,
    definition: null,
    example: null,
    partOfSpeech: null,
    source: "unavailable",
  };
}

function senseToResult(sense: DictionarySense): LookupResult {
  return {
    word: sense.word,
    definition: sense.definition,
    example: sense.example ?? null,
    partOfSpeech: sense.partOfSpeech ?? null,
    source: sense.source,
  };
}

async function fetchJson(url: string): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "HomeSchoolAcademy/1.0 (read-along dictionary)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status >= 500) {
        if (attempt === 0) continue;
        return null;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

async function fetchMerriamWebster(
  word: string,
  apiKey: string,
): Promise<DictionarySense | null> {
  const url =
    `https://www.dictionaryapi.com/api/v3/references/collegiate/json/` +
    `${encodeURIComponent(word)}?key=${encodeURIComponent(apiKey)}`;
  const payload = await fetchJson(url);
  return parseMerriamWebster(word, payload);
}

async function fetchFreeDictionary(word: string): Promise<DictionarySense | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const payload = await fetchJson(url);
  return parseFreeDictionary(word, payload);
}

async function fetchDictionarySense(word: string): Promise<DictionarySense | null> {
  const mwKey = websterKeyFromEnv();
  if (mwKey) {
    const mw = await fetchMerriamWebster(word, mwKey);
    if (mw) return mw;
  }
  return await fetchFreeDictionary(word);
}

export const getByWordInternal = internalQuery({
  args: { word: v.string() },
  returns: v.union(dictionaryEntryDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_word", (q) => q.eq("word", args.word))
      .unique();
  },
});

export const upsertFromLookup = internalMutation({
  args: {
    word: v.string(),
    definition: v.string(),
    partOfSpeech: v.optional(v.string()),
    example: v.optional(v.string()),
    source: dictionarySourceValidator,
  },
  returns: v.id("dictionaryEntries"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_word", (q) => q.eq("word", args.word))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch("dictionaryEntries", existing._id, {
        definition: args.definition,
        partOfSpeech: args.partOfSpeech,
        example: args.example,
        source: args.source,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("dictionaryEntries", {
      word: args.word,
      definition: args.definition,
      partOfSpeech: args.partOfSpeech,
      example: args.example,
      source: args.source,
      createdAt: now,
    });
  },
});

export const get = query({
  args: { word: v.string() },
  returns: v.union(dictionaryEntryDocValidator, v.null()),
  handler: async (ctx, args) => {
    await getCurrentUser(ctx);
    const word = normalizeDictionaryWord(args.word);
    if (!word) return null;
    return await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_word", (q) => q.eq("word", word))
      .unique();
  },
});

export const list = query({
  args: {},
  returns: v.array(dictionaryEntryDocValidator),
  handler: async (ctx) => {
    await getCurrentUser(ctx);
    return await ctx.db.query("dictionaryEntries").order("desc").take(LIST_LIMIT);
  },
});

export const create = mutation({
  args: {
    word: v.string(),
    definition: v.string(),
    partOfSpeech: v.optional(v.string()),
    example: v.optional(v.string()),
  },
  returns: v.id("dictionaryEntries"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "parent", "teacher"]);
    const word = normalizeDictionaryWord(args.word);
    if (!word) throw new Error("Word is required");
    const definition = args.definition.trim();
    if (!definition) throw new Error("Definition is required");

    const existing = await ctx.db
      .query("dictionaryEntries")
      .withIndex("by_word", (q) => q.eq("word", word))
      .unique();
    if (existing) throw new Error("Dictionary entry already exists for this word");

    return await ctx.db.insert("dictionaryEntries", {
      word,
      definition,
      partOfSpeech: args.partOfSpeech?.trim() || undefined,
      example: args.example?.trim() || undefined,
      source: "manual",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    entryId: v.id("dictionaryEntries"),
    definition: v.optional(v.string()),
    partOfSpeech: v.optional(v.string()),
    example: v.optional(v.string()),
  },
  returns: v.id("dictionaryEntries"),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "parent", "teacher"]);
    const entry = await ctx.db.get("dictionaryEntries", args.entryId);
    if (!entry) throw new Error("Dictionary entry not found");

    const definition = args.definition?.trim();
    if (args.definition !== undefined && !definition) {
      throw new Error("Definition is required");
    }

    await ctx.db.patch("dictionaryEntries", args.entryId, {
      ...(definition ? { definition } : {}),
      ...(args.partOfSpeech !== undefined
        ? { partOfSpeech: args.partOfSpeech.trim() || undefined }
        : {}),
      ...(args.example !== undefined
        ? { example: args.example.trim() || undefined }
        : {}),
      source: "manual",
      updatedAt: Date.now(),
    });
    return args.entryId;
  },
});

export const remove = mutation({
  args: { entryId: v.id("dictionaryEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superAdmin", "parent", "teacher"]);
    const entry = await ctx.db.get("dictionaryEntries", args.entryId);
    if (!entry) throw new Error("Dictionary entry not found");
    await ctx.db.delete("dictionaryEntries", args.entryId);
    return null;
  },
});

async function lookupWord(ctx: ActionCtx, wordArg: string): Promise<LookupResult> {
  const word = normalizeDictionaryWord(wordArg);
  if (!word) return unavailableResult(wordArg.trim());

  const cached = await ctx.runQuery(internal.dictionary.getByWordInternal, { word });
  if (cached) {
    return {
      word: cached.word,
      definition: cached.definition,
      example: cached.example ?? null,
      partOfSpeech: cached.partOfSpeech ?? null,
      source: cached.source,
    };
  }

  const sense = await fetchDictionarySense(word);
  if (!sense) return unavailableResult(word);

  await ctx.runMutation(internal.dictionary.upsertFromLookup, {
    word: sense.word,
    definition: sense.definition,
    partOfSpeech: sense.partOfSpeech,
    example: sense.example,
    source: sense.source,
  });
  return senseToResult(sense);
}

export const lookup = action({
  args: { word: v.string() },
  returns: lookupResultValidator,
  handler: async (ctx, args): Promise<LookupResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await lookupWord(ctx, args.word);
  },
});
