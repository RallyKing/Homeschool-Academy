export const GRADE_LEVEL_OPTIONS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "K-2",
  "3-5",
  "6-8",
  "9-12",
  "early",
  "middle",
  "high",
] as const;

export const LENGTH_OPTIONS = [
  { value: "short", label: "Short (~3 min, 60–90 words)" },
  { value: "medium", label: "Medium (~6 min, 120–180 words)" },
  { value: "long", label: "Long (~10 min, 200–280 words)" },
] as const;
