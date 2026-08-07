# Homeschool Academy — Companion & Tracker

Multi-tenant companion for homeschool families: students, courses, weekly planners, learning ledger, academy subscriptions, and modular AI capabilities (guardrails, badge craft, course assist, family insights).

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

## Password reset

Sign-in includes **Forgot password?** → `/reset-password`.

1. User enters email (`flow=reset`) → Convex Auth emails an 8-digit OTP (via Resend)
2. User enters code + new password (`flow=reset-verification`) → password updated and signed in

### Email env (Convex deployment)

Set on the Convex deployment (Dashboard → Settings → Environment Variables, or CLI):

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_RESEND_KEY` | Yes (for email) | Resend API key (preferred name) |
| `RESEND_API_KEY` | Alias | Same key if you prefer this name |
| `AUTH_EMAIL_FROM` | No | From address; default `Homeschool Academy <onboarding@resend.dev>` |
| `SITE_URL` | Yes (auth) | App origin, e.g. `https://homeschool-academy.vercel.app` |

Without `AUTH_RESEND_KEY` / `RESEND_API_KEY`, reset UI still works: the OTP is **logged in Convex logs** so you can complete a reset in development or as an emergency recovery path. Production should set a Resend key and a verified `AUTH_EMAIL_FROM` domain.

## Demo path (parent)

1. Sign up as **Parent** → onboarding creates a family
2. Add a student (name + level)
3. **Courses** → create native or external (Zearn-style) course; seed subjects if needed
4. **Planner** → draft week → add items → request approval → approve
5. **Ledger** → log time → verify as parent
6. **Progress** / **AI** (`/family/ai`) for activity + modular AI (guardrails, badges, course help, insights)
7. Optional: `/admin` → bootstrap SuperAdmin once

See [docs/ai-capabilities.md](docs/ai-capabilities.md) for the capability registry and how to enable live LLMs.

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

Set `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` on the Convex deployment for live LLM capabilities (mocks work without keys). See [docs/ai-capabilities.md](docs/ai-capabilities.md).
