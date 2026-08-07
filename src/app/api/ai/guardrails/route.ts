import { NextRequest, NextResponse } from "next/server";

/**
 * Mirrors the Convex ai.filterPrompt mock so the API route works
 * even before Convex actions are fully wired with auth tokens.
 */
function mockGuardrails(studentPrompt: string, parentGuardrailContext: string) {
  const prompt = studentPrompt.toLowerCase();
  const blockedKeywords = [
    "weapon",
    "violence",
    "gambling",
    "dating",
    "bypass",
    "cheat on test",
  ];

  const blockMatch = /block:\s*([^\n]+)/i.exec(parentGuardrailContext);
  const parentBlocks =
    blockMatch?.[1]
      ?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];

  const allBlocked = [...blockedKeywords, ...parentBlocks];
  const filteredTopics = allBlocked.filter((term) => prompt.includes(term));

  if (filteredTopics.length > 0) {
    return {
      allowed: false,
      response:
        "I can't help with that topic. Let's pick something that fits your family's learning guidelines.",
      filteredTopics,
      reason: `Blocked by guardrails: ${filteredTopics.join(", ")}`,
    };
  }

  return {
    allowed: true,
    response: `[Mock educational assistant] Regarding: "${studentPrompt.slice(0, 200)}" — break it into steps and take one clear next action.`,
    filteredTopics: [] as string[],
    reason: "Passed parent guardrail context",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      studentPrompt?: string;
      parentGuardrailContext?: string;
    };

    if (!body.studentPrompt || !body.parentGuardrailContext) {
      return NextResponse.json(
        { error: "studentPrompt and parentGuardrailContext are required" },
        { status: 400 },
      );
    }

    const result = mockGuardrails(
      body.studentPrompt,
      body.parentGuardrailContext,
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
