export function buildSpeechTicketPrompt(args: {
  word: string;
  heardAs: string[];
  notes?: string;
}): { title: string; body: string } {
  const word = args.word.trim() || "unknown";
  const heard = args.heardAs.map((s) => s.trim()).filter(Boolean);
  const heardLine = heard.length > 0 ? heard.join(", ") : "(none recorded)";
  const notes = args.notes?.trim();
  const title = `Read-along ASR: "${word}"`;
  const body = [
    `Read-along ASR fails for word "${word}". Heard as: ${heardLine}. Fix aliases in readAlongSpeech.ts and add tests.`,
    "",
    "## Word",
    word,
    "",
    "## How ASR heard it",
    heardLine,
    notes ? `\n## Notes\n${notes}\n` : "",
    "## Steps for Cursor",
    "1. Open `src/lib/readAlongSpeech.ts`.",
    `2. Add target-specific aliases for "${word}" covering the heard variants.`,
    "3. Add unit tests in `src/lib/readAlongSpeech.listen.test.ts`.",
    "4. Keep sequential prefix matching (do not skip unread words).",
    "5. Run the read-along speech tests and typecheck.",
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
  return { title, body };
}
