import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const MESSAGE_BODY_MAX = 280;

export const KINDNESS_XP = 5;
export const KINDNESS_POINTS = 3;
export const STICKER_XP = 4;
export const STICKER_POINTS = 2;

export type MessageKind =
  | "encourage"
  | "motivate"
  | "congratulate"
  | "sticker";

export type UnlockCriterion =
  | { type: "kindnessGiven"; value: number }
  | { type: "kindnessReceived"; value: number }
  | { type: "stickersSent"; value: number }
  | { type: "level"; value: number }
  | { type: "totalLogs"; value: number };

export type UnlockDef = {
  unlockKey: string;
  title: string;
  description: string;
  category: "pack" | "theme" | "frame" | "bubble";
  appliesTo?: string;
  criterion: UnlockCriterion;
};

export const DEFAULT_THEME = "default";
export const DEFAULT_FRAME = "none";
export const DEFAULT_BUBBLE = "classic";
export const STARTER_PACK = "starter";

/** Suggested prompts — free text still allowed. */
export const MESSAGE_PRESETS: Record<
  Exclude<MessageKind, "sticker">,
  string[]
> = {
  encourage: [
    "You've got this — keep going!",
    "I'm cheering for you today.",
    "One step at a time. You're doing great.",
  ],
  motivate: [
    "Let's finish strong together!",
    "Your effort inspires me.",
    "Small progress still counts — keep at it!",
  ],
  congratulate: [
    "Amazing work — so proud of you!",
    "You did it! Celebrate this win.",
    "Well done — that took heart.",
  ],
};

export const THEME_OPTIONS = [
  { key: "default", label: "Soft Day", description: "Calm teal accents" },
  { key: "sunrise", label: "Sunrise", description: "Warm peach glow" },
  { key: "ocean_calm", label: "Ocean Calm", description: "Soft blue calm" },
  { key: "meadow", label: "Meadow", description: "Gentle green" },
] as const;

export const FRAME_OPTIONS = [
  { key: "none", label: "No frame", description: "Simple avatar" },
  { key: "soft_ring", label: "Soft ring", description: "Gentle outline" },
  { key: "golden_halo", label: "Warm halo", description: "Soft golden glow" },
  {
    key: "friendship_wreath",
    label: "Friendship wreath",
    description: "Leafy cheer frame",
  },
] as const;

export const BUBBLE_OPTIONS = [
  { key: "classic", label: "Classic", description: "Clean chat bubble" },
  { key: "soft_cloud", label: "Soft cloud", description: "Rounded cloud shape" },
  { key: "sparkle", label: "Sparkle", description: "Light spark accents" },
] as const;

export const STICKER_PACK_SEED: Array<{
  packKey: string;
  title: string;
  description: string;
  sortOrder: number;
  free: boolean;
  stickers: Array<{
    stickerKey: string;
    label: string;
    emoji: string;
    sortOrder: number;
  }>;
}> = [
  {
    packKey: STARTER_PACK,
    title: "Starter Cheers",
    description: "Friendly basics to share kindness.",
    sortOrder: 0,
    free: true,
    stickers: [
      { stickerKey: "high_five", label: "High five", emoji: "🙌", sortOrder: 0 },
      { stickerKey: "smile", label: "Smile", emoji: "😊", sortOrder: 1 },
      { stickerKey: "thumbs_up", label: "Thumbs up", emoji: "👍", sortOrder: 2 },
      { stickerKey: "heart", label: "Heart", emoji: "💙", sortOrder: 3 },
    ],
  },
  {
    packKey: "warm_hearts",
    title: "Warm Hearts",
    description: "Cozy encouragement for siblings.",
    sortOrder: 1,
    free: false,
    stickers: [
      { stickerKey: "hug", label: "Hug", emoji: "🤗", sortOrder: 0 },
      { stickerKey: "warm_sun", label: "Warm sun", emoji: "☀️", sortOrder: 1 },
      { stickerKey: "cozy_star", label: "Cozy star", emoji: "⭐", sortOrder: 2 },
    ],
  },
  {
    packKey: "nature_cheer",
    title: "Nature Cheer",
    description: "Grow together with gentle nature vibes.",
    sortOrder: 2,
    free: false,
    stickers: [
      { stickerKey: "blossom", label: "Blossom", emoji: "🌸", sortOrder: 0 },
      { stickerKey: "sprout", label: "Sprout", emoji: "🌱", sortOrder: 1 },
      { stickerKey: "rainbow", label: "Rainbow", emoji: "🌈", sortOrder: 2 },
    ],
  },
  {
    packKey: "celebration",
    title: "Celebration",
    description: "Cheer big moments without competing.",
    sortOrder: 3,
    free: false,
    stickers: [
      {
        stickerKey: "sparkle_burst",
        label: "Sparkle burst",
        emoji: "✨",
        sortOrder: 0,
      },
      {
        stickerKey: "cheer_banner",
        label: "Cheer banner",
        emoji: "🎉",
        sortOrder: 1,
      },
      { stickerKey: "clap", label: "Clap", emoji: "👏", sortOrder: 2 },
    ],
  },
];

/** Unlock progression — generosity first; learning is a gentle secondary path. */
export const UNLOCK_DEFS: UnlockDef[] = [
  {
    unlockKey: "pack_warm_hearts",
    title: "Warm Hearts pack",
    description: "Send 3 kindness messages to unlock cozy stickers.",
    category: "pack",
    appliesTo: "warm_hearts",
    criterion: { type: "kindnessGiven", value: 3 },
  },
  {
    unlockKey: "theme_sunrise",
    title: "Sunrise theme",
    description: "Send 8 kindness messages to unlock a warm palette.",
    category: "theme",
    appliesTo: "sunrise",
    criterion: { type: "kindnessGiven", value: 8 },
  },
  {
    unlockKey: "bubble_soft_cloud",
    title: "Soft cloud bubbles",
    description: "Send 12 kindness messages to unlock cloud chat style.",
    category: "bubble",
    appliesTo: "soft_cloud",
    criterion: { type: "kindnessGiven", value: 12 },
  },
  {
    unlockKey: "pack_celebration",
    title: "Celebration pack",
    description: "Send 20 kindness messages to unlock celebration stickers.",
    category: "pack",
    appliesTo: "celebration",
    criterion: { type: "kindnessGiven", value: 20 },
  },
  {
    unlockKey: "frame_golden_halo",
    title: "Warm halo frame",
    description: "Receive 5 cheers to unlock a warm avatar halo.",
    category: "frame",
    appliesTo: "golden_halo",
    criterion: { type: "kindnessReceived", value: 5 },
  },
  {
    unlockKey: "pack_nature_cheer",
    title: "Nature Cheer pack",
    description: "Send 5 stickers to unlock nature stickers.",
    category: "pack",
    appliesTo: "nature_cheer",
    criterion: { type: "stickersSent", value: 5 },
  },
  {
    unlockKey: "theme_ocean_calm",
    title: "Ocean Calm theme",
    description: "Send 15 stickers to unlock a calm blue theme.",
    category: "theme",
    appliesTo: "ocean_calm",
    criterion: { type: "stickersSent", value: 15 },
  },
  {
    unlockKey: "frame_friendship_wreath",
    title: "Friendship wreath",
    description: "Send 30 kindness messages to unlock a leafy frame.",
    category: "frame",
    appliesTo: "friendship_wreath",
    criterion: { type: "kindnessGiven", value: 30 },
  },
  {
    unlockKey: "frame_soft_ring",
    title: "Soft ring frame",
    description: "Reach level 3 to unlock a soft avatar ring.",
    category: "frame",
    appliesTo: "soft_ring",
    criterion: { type: "level", value: 3 },
  },
  {
    unlockKey: "theme_meadow",
    title: "Meadow theme",
    description: "Log 10 learning sessions to unlock meadow greens.",
    category: "theme",
    appliesTo: "meadow",
    criterion: { type: "totalLogs", value: 10 },
  },
  {
    unlockKey: "bubble_sparkle",
    title: "Sparkle bubbles",
    description: "Log 20 learning sessions to unlock sparkle chat style.",
    category: "bubble",
    appliesTo: "sparkle",
    criterion: { type: "totalLogs", value: 20 },
  },
];

export function participantKey(
  a: Id<"students">,
  b: Id<"students">,
): string {
  return [a, b].sort().join("|");
}

export function normalizeBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;
  const trimmed = body.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MESSAGE_BODY_MAX) {
    throw new Error(`Message must be ${MESSAGE_BODY_MAX} characters or fewer`);
  }
  return trimmed;
}

export async function getOrCreateSocialStats(
  ctx: MutationCtx,
  studentId: Id<"students">,
  familyId: Id<"families">,
): Promise<Doc<"studentSocialStats">> {
  const existing = await ctx.db
    .query("studentSocialStats")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("studentSocialStats", {
    studentId,
    familyId,
    kindnessGiven: 0,
    kindnessReceived: 0,
    stickersSent: 0,
    stickersReceived: 0,
    updatedAt: Date.now(),
  });
  const doc = await ctx.db.get("studentSocialStats", id);
  if (!doc) throw new Error("Failed to create social stats");
  return doc;
}

export async function getOrCreateCustomization(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<Doc<"studentCustomization">> {
  const existing = await ctx.db
    .query("studentCustomization")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("studentCustomization", {
    studentId,
    themeKey: DEFAULT_THEME,
    frameKey: DEFAULT_FRAME,
    bubbleKey: DEFAULT_BUBBLE,
    unlockedPackIds: [STARTER_PACK],
    updatedAt: Date.now(),
  });
  const doc = await ctx.db.get("studentCustomization", id);
  if (!doc) throw new Error("Failed to create customization");
  return doc;
}

function criterionMet(
  criterion: UnlockCriterion,
  stats: Doc<"studentSocialStats">,
  level: number,
  totalLogs: number,
): boolean {
  switch (criterion.type) {
    case "kindnessGiven":
      return stats.kindnessGiven >= criterion.value;
    case "kindnessReceived":
      return stats.kindnessReceived >= criterion.value;
    case "stickersSent":
      return stats.stickersSent >= criterion.value;
    case "level":
      return level >= criterion.value;
    case "totalLogs":
      return totalLogs >= criterion.value;
  }
}

export async function evaluateUnlocks(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<string[]> {
  const stats = await ctx.db
    .query("studentSocialStats")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .unique();
  if (!stats) return [];

  const gamification = await ctx.db
    .query("studentGamification")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .unique();
  const level = gamification?.level ?? 1;
  const totalLogs = gamification?.totalLogs ?? 0;

  const customization = await getOrCreateCustomization(ctx, studentId);
  const existing = await ctx.db
    .query("studentUnlocks")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  const have = new Set(existing.map((u) => u.unlockKey));
  const newly: string[] = [];
  const packIds = new Set(customization.unlockedPackIds);

  for (const def of UNLOCK_DEFS) {
    if (have.has(def.unlockKey)) continue;
    if (!criterionMet(def.criterion, stats, level, totalLogs)) continue;

    await ctx.db.insert("studentUnlocks", {
      studentId,
      unlockKey: def.unlockKey,
      unlockedAt: Date.now(),
    });
    newly.push(def.unlockKey);

    if (def.category === "pack" && def.appliesTo) {
      packIds.add(def.appliesTo);
    }
  }

  if (newly.length > 0) {
    await ctx.db.patch("studentCustomization", customization._id, {
      unlockedPackIds: [...packIds],
      updatedAt: Date.now(),
    });
  }

  return newly;
}

export async function seedStickerCatalog(ctx: MutationCtx): Promise<{
  packs: number;
  stickers: number;
}> {
  let packs = 0;
  let stickers = 0;
  const now = Date.now();

  for (const pack of STICKER_PACK_SEED) {
    const existing = await ctx.db
      .query("stickerPacks")
      .withIndex("by_packKey", (q) => q.eq("packKey", pack.packKey))
      .unique();

    let packId: Id<"stickerPacks">;
    if (existing) {
      await ctx.db.patch("stickerPacks", existing._id, {
        title: pack.title,
        description: pack.description,
        sortOrder: pack.sortOrder,
        free: pack.free,
      });
      packId = existing._id;
    } else {
      packId = await ctx.db.insert("stickerPacks", {
        packKey: pack.packKey,
        title: pack.title,
        description: pack.description,
        sortOrder: pack.sortOrder,
        free: pack.free,
        createdAt: now,
      });
      packs += 1;
    }

    for (const sticker of pack.stickers) {
      const existingSticker = await ctx.db
        .query("stickers")
        .withIndex("by_stickerKey", (q) =>
          q.eq("stickerKey", sticker.stickerKey),
        )
        .unique();
      if (existingSticker) {
        await ctx.db.patch("stickers", existingSticker._id, {
          packId,
          label: sticker.label,
          emoji: sticker.emoji,
          sortOrder: sticker.sortOrder,
        });
      } else {
        await ctx.db.insert("stickers", {
          packId,
          stickerKey: sticker.stickerKey,
          label: sticker.label,
          emoji: sticker.emoji,
          sortOrder: sticker.sortOrder,
          createdAt: now,
        });
        stickers += 1;
      }
    }
  }

  return { packs, stickers };
}

export async function findStickerByKey(
  ctx: QueryCtx | MutationCtx,
  stickerKey: string,
): Promise<Doc<"stickers"> | null> {
  return await ctx.db
    .query("stickers")
    .withIndex("by_stickerKey", (q) => q.eq("stickerKey", stickerKey))
    .unique();
}

export async function assertPackUnlocked(
  ctx: MutationCtx,
  studentId: Id<"students">,
  packKey: string,
): Promise<void> {
  if (packKey === STARTER_PACK) return;
  const pack = await ctx.db
    .query("stickerPacks")
    .withIndex("by_packKey", (q) => q.eq("packKey", packKey))
    .unique();
  if (pack?.free) return;

  const customization = await getOrCreateCustomization(ctx, studentId);
  if (!customization.unlockedPackIds.includes(packKey)) {
    throw new Error("That sticker pack is still locked — keep cheering!");
  }
}

export async function deleteSocialForStudent(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const stats = await ctx.db
    .query("studentSocialStats")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const s of stats) {
    await ctx.db.delete("studentSocialStats", s._id);
  }

  const customs = await ctx.db
    .query("studentCustomization")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const c of customs) {
    await ctx.db.delete("studentCustomization", c._id);
  }

  const unlocks = await ctx.db
    .query("studentUnlocks")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  for (const u of unlocks) {
    await ctx.db.delete("studentUnlocks", u._id);
  }

  const fromMsgs = await ctx.db
    .query("socialMessages")
    .withIndex("by_from", (q) => q.eq("fromStudentId", studentId))
    .collect();
  for (const m of fromMsgs) {
    await ctx.db.delete("socialMessages", m._id);
  }

  const toMsgs = await ctx.db
    .query("socialMessages")
    .withIndex("by_to", (q) => q.eq("toStudentId", studentId))
    .collect();
  for (const m of toMsgs) {
    await ctx.db.delete("socialMessages", m._id);
  }

  const student = await ctx.db.get("students", studentId);
  if (student) {
    const threads = await ctx.db
      .query("socialThreads")
      .withIndex("by_family", (q) => q.eq("familyId", student.familyId))
      .collect();
    for (const t of threads) {
      if (!t.participantStudentIds.includes(studentId)) continue;
      const remaining = await ctx.db
        .query("socialMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", t._id))
        .collect();
      for (const m of remaining) {
        await ctx.db.delete("socialMessages", m._id);
      }
      await ctx.db.delete("socialThreads", t._id);
    }
  }
}
