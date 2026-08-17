export const LEAVE_STORY_PROMPT =
  "Leave this story? You can switch stories and resume this one later.";

export const MIC_PLAY_LABEL = "Play";
export const MIC_PAUSE_LABEL = "Pause";

export function shouldConfirmLeaveReadAlong(status: string): boolean {
  return status === "in_progress" || status === "practice";
}

export function requestLeaveReadAlong(args: {
  status: string;
  confirm: (message: string) => boolean;
}): boolean {
  if (!shouldConfirmLeaveReadAlong(args.status)) return true;
  return args.confirm(LEAVE_STORY_PROMPT);
}

export function micControlLabel(listening: boolean): string {
  return listening ? MIC_PAUSE_LABEL : MIC_PLAY_LABEL;
}
