# Homeschool Academy — Companion & Tracker

Multi-tenant companion for homeschool families: students, courses, weekly planners, learning ledger, academy subscriptions, and AI guardrails.

**Live:** [https://homeschool-academy.vercel.app](https://homeschool-academy.vercel.app)  
**Repo:** [https://github.com/RallyKing/Homeschool-Academy](https://github.com/RallyKing/Homeschool-Academy)

## Stack

- Next.js App Router + Tailwind
- Convex (DB + reactive backend)
- Convex Auth (Password) — Clerk deferred
- Vercel

## Local setup

```bash
npm install
npx convex login
npx convex dev
```

In a second terminal (auth keys):

```bash
npx @convex-dev/auth --web-server-url http://localhost:3000
npm run dev
```

## Demo path (parent)

1. Sign up as **Parent** → onboarding creates a family
2. Add a student (name + level)
3. **Courses** → create native or external (Zearn-style) course; seed subjects if needed
4. **Planner** → draft week → add items → request approval → approve
5. **Ledger** → log time → verify as parent
6. **Progress** / **AI guardrails** for activity + demo assistant
7. Optional: `/admin` → bootstrap SuperAdmin once

## Role URLs

| Role | Paths |
|------|--------|
| Parent | `/family/dashboard`, `/courses`, `/planner`, `/ledger`, `/academies`, `/progress`, `/ai` |
| Student | `/student/dashboard` |
| Teacher | `/academy/dashboard` |
| Admin | `/admin` |

## Production

```bash
npx convex deploy --yes
git push origin master   # Vercel auto-deploys
```

Set `OPENAI_API_KEY` on the Convex deployment for live LLM guardrails (mock works without it).
