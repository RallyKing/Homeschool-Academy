export const READ_ALONG_DOCK_BACK = "Back";
export const READ_ALONG_DOCK_BACKUP = "Backup";
export const READ_ALONG_DOCK_NEXT = "Next";
export const READ_ALONG_DOCK_HEAR_WORD = "Hear this word";
export const READ_ALONG_DOCK_READ_TO_ME = "Read to me";
export const READ_ALONG_DOCK_STOP = "Stop";
export const READ_ALONG_DOCK_SETTINGS = "Settings";

/** Sticky story-mode dock, left to right. Read to me is never omitted. */
export function readAlongStoryDockLabels(opts: {
  micOk: boolean;
  listening: boolean;
  narrating: boolean;
}): string[] {
  const labels: string[] = [READ_ALONG_DOCK_BACK];
  if (opts.micOk) {
    labels.push(opts.listening ? "Pause" : "Play");
  }
  labels.push(
    READ_ALONG_DOCK_BACKUP,
    READ_ALONG_DOCK_NEXT,
    READ_ALONG_DOCK_HEAR_WORD,
    opts.narrating ? READ_ALONG_DOCK_STOP : READ_ALONG_DOCK_READ_TO_ME,
    READ_ALONG_DOCK_SETTINGS,
  );
  return labels;
}
