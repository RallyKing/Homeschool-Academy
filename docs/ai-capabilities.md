# Modular AI capabilities

Homeschool Academy uses a **capability registry** so AI is narrow, typed, and swappable (mock → OpenAI / Vercel AI Gateway).

## Capabilities

| ID | Module | Purpose |
|----|--------|---------|
| `guardrails` | `convex/ai/guardrails.ts` (+ `api.ai.filterPrompt`) | Parent-approved prompt filter |
| `badge_craft` | `convex/ai/badgeCraft.ts` | Age-appropriate badge proposals |
| `course_assist` | `convex/ai/courseAssist.ts` | On-topic help inside one course |
| `family_optimize` | `convex/ai/familyOptimize.ts` | Family plan tips from aggregate stats |
| `child_personalize` | `convex/ai/childPersonalize.ts` | Per-child learning recommendations |

Registry metadata: `convex/ai/capabilities.ts` → `api.ai.capabilities.listCapabilities`.

## Why narrow parsing works

Each capability has:

1. A **strict system prompt** limited to that job
2. **Typed Convex validators** for inputs and outputs
3. Prefer **JSON-only** LLM replies that are parsed and validated before use
4. **Deterministic mocks** when no API key is set — same shapes as live LLM

Do not merge capabilities into one mega-prompt. Add a new file + registry entry instead.

## Enable real AI later

On the Convex deployment (Dashboard → Settings → Environment Variables):

| Variable | Effect |
|----------|--------|
| `OPENAI_API_KEY` | Chat Completions via `https://api.openai.com/v1` |
| `AI_GATEWAY_API_KEY` (or `VERCEL_AI_GATEWAY_API_KEY`) | Prefer Vercel AI Gateway |
| `AI_GATEWAY_BASE_URL` | Optional gateway base (default `https://ai-gateway.vercel.sh/v1`) |
| `AI_MODEL` | Optional model id |

No code change required for the mock → live flip. Without keys, every capability returns high-quality mocks.

## Badge craft → accept flow

1. Parent opens `/family/ai?tab=badges`
2. `badgeCraft.craft` loads student stats (age band from `birthYear`, level/XP/logs/chores) and proposes 2–4 badges
3. Proposals persist as `badgeProposals` with `status: pending`
4. Parent **Edit / Reject / Delete** or **Accept & grant**
5. Accept creates a family-scoped `badges` row (`source: "ai"`, `criteriaType: "manual"`) and inserts `studentBadges`

Students only see earned badges. Generation is parent-gated.

## UI

- `/family/ai` tabs: Guardrails | Badge craft | Course assist | Family insights
- `CourseAssistPanel` stub also available for course / Plan surfaces

Social encouragement (`/student/social`) is separate — do not route AI there.

## Safety

- Parent guardrails on every student-facing capability
- Age / developmental band on badge + child personalize
- No competitive ranking / sibling comparison language
- Family/child tips are pacing suggestions — **not medical claims**
- Badge proposals require explicit parent accept before grant

## Add a capability

1. Extend `CapabilityId` in `convex/ai/types.ts`
2. Add meta in `CAPABILITY_REGISTRY`
3. Create `convex/ai/<name>.ts` with `"use node"`, mock + optional `chatCompletion`
4. Wire UI under `/family/ai` (or a domain stub)
5. Document the id in this file
