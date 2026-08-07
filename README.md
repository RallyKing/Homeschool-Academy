# Homeschool Academy — Companion & Tracker

Schema-first foundation: Next.js App Router + Convex + Convex Auth (Password).

**Live:** [https://homeschool-academy.vercel.app](https://homeschool-academy.vercel.app)  
**Repo:** [https://github.com/RallyKing/Homeschool-Academy](https://github.com/RallyKing/Homeschool-Academy)  
**Convex dashboard:** [https://dashboard.convex.dev/t/joshua-ballard/homeschool-academy](https://dashboard.convex.dev/t/joshua-ballard/homeschool-academy)

## Prerequisites

- Node.js 18+ (20+ recommended)
- A [Convex](https://convex.dev) account (free)
- Optional: [Vercel CLI](https://vercel.com/docs/cli) and [GitHub CLI](https://cli.github.com/)

## Local setup

```bash
npm install
npx convex login
npx convex dev
```

`convex dev` writes `NEXT_PUBLIC_CONVEX_URL` (and related vars) to `.env.local`, generates `convex/_generated/`, and watches the backend.

In a second terminal (first time, or after creating a new deployment):

```bash
npx @convex-dev/auth --web-server-url http://localhost:3000
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Use `npx convex dev` for all local backend work.** Use `npx convex deploy` only when shipping the production Convex backend.

## First-run checklist

1. Sign up as a **parent** at `/sign-up`
2. Family dashboard → Create family → Add a student
3. Log an entry with the Log Entry form
4. Create a draft schedule and request approval
5. (Optional) Visit `/admin` and bootstrap SuperAdmin if none exists
6. Seed subject taxonomy from Family or Admin dashboard

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js frontend |
| `npx convex dev` | Convex backend (dev) |
| `npm run build` | Production Next.js build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

## Production deploy (already wired)

### Convex production

```bash
npx convex deploy --yes
npx @convex-dev/auth --prod --web-server-url https://homeschool-academy.vercel.app
```

Production deployment URL: `https://rightful-caiman-789.convex.cloud`

### Vercel

Project is linked to this repo. Env vars set for Production / Preview / Development:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `SITE_URL` (production + preview → `https://homeschool-academy.vercel.app`)

Redeploy:

```bash
npx vercel deploy --prod --yes
```

Or push to `master` (GitHub integration is connected).

After changing the production domain, update Convex Auth:

```bash
npx convex env set SITE_URL https://YOUR_DOMAIN --prod
```

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
