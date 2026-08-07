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

## Install as an app (PWA)

Homeschool Academy is a Progressive Web App. On a supported browser you can install it to your tablet, phone, or computer home screen / app launcher (standalone window, no browser chrome).

| Device | How to install |
|--------|----------------|
| **Android / Chrome tablet** | Open the site → browser menu (**⋮**) → **Install app** / **Add to Home screen**. Or tap **Install app** in the top nav when Chrome offers it. |
| **iPad / iPhone (Safari)** | Open the site in **Safari** → tap **Share** → **Add to Home Screen**. (Chrome/Firefox on iOS cannot install PWAs the same way.) |
| **Windows / macOS (Chrome or Edge)** | Open the site → look for the install icon in the address bar, or use the menu → **Install Homeschool Academy**. Or tap **Install app** in the nav when prompted. |

**Notes:** Install requires HTTPS (already true on Vercel). iOS Safari does not fire `beforeinstallprompt`; use Share → Add to Home Screen. Offline shows a simple fallback page — live Convex data still needs a network connection.

## Production

```bash
npx convex deploy --yes
git push origin master   # Vercel auto-deploys
```

Set `OPENAI_API_KEY` on the Convex deployment for live LLM guardrails (mock works without it).
