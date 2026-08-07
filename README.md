# Homeschool Academy — Companion & Tracker

Schema-first foundation: Next.js App Router + Convex + Convex Auth (Password).

## Prerequisites

- Node.js 18+ (20+ recommended)
- A [Convex](https://convex.dev) account (free)

## Setup

```bash
npm install
```

### 1. Start Convex (development)

```bash
npx convex dev
```

This will:

1. Log you in (browser) if needed
2. Create/link a Convex project
3. Write `NEXT_PUBLIC_CONVEX_URL` to `.env.local`
4. Generate `convex/_generated/`
5. Watch and push backend changes

**Use `npx convex dev` for all development.** Do not use `npx convex deploy` until you intentionally ship to production.

### 2. Configure Convex Auth

In a second terminal (or after the first `convex dev` sync):

```bash
npx @convex-dev/auth
```

Follow prompts to set `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` on your **dev** deployment.

Or set them manually in the Convex dashboard → Settings → Environment Variables. See [Convex Auth setup](https://labs.convex.dev/auth).

Also ensure `.env.local` has:

```bash
NEXT_PUBLIC_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
# Optional for local Next app URL used by auth redirects:
SITE_URL=http://localhost:3000
```

### 3. Run the Next.js app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## First-run checklist

1. Sign up as a **parent** at `/sign-up`
2. Open Family dashboard → Create family → Add a student
3. Log an entry with the Log Entry form
4. Create a draft schedule and request approval
5. (Optional) Visit `/admin` and bootstrap SuperAdmin if none exists
6. Seed subject taxonomy from Family or Admin dashboard

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js frontend |
| `npx convex dev` | Convex backend (dev) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

See `docs/superpowers/specs/2026-08-06-homeschool-academy-foundation-design.md`.

Roles: `superAdmin` → Family (tenant) → Student; Academy is adjacent (teachers; families subscribe).

## Intentionally deferred

- Clerk (Convex Auth now)
- Real LLM provider (mock AI guardrails only)
- Rich planner calendar UI
- Full academy course marketplace / file upload UX

## AI guardrails

- Convex action: `api.ai.filterPrompt`
- HTTP mirror: `POST /api/ai/guardrails` with JSON `{ "studentPrompt", "parentGuardrailContext" }`
