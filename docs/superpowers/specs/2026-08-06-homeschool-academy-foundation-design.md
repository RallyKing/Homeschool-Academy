# Homeschool Academy Foundation Design

**Date:** 2026-08-06  
**Approach:** A — Schema-first scaffold  
**Status:** Approved — implement immediately

## Product

**Homeschool Academy: Companion & Tracker** — multi-tenant homeschool platform where families manage students, log learning time, plan schedules, and optionally subscribe to academy (teacher) courses.

## Stack

- Next.js App Router + React + TypeScript + Tailwind CSS
- Convex (reactive backend + DB)
- Convex Auth (Password provider) now; Clerk deferred
- Vercel-ready; GitHub

## Hierarchy

1. **God Mode / SuperAdmin** — platform administration
2. **Family Profile (tenant)** — parents manage students
3. **Student Profile** — child of a family
4. **Academy Profile (adjacent)** — teachers; families opt-in via subscriptions

## Roles

| Role | Scope |
|------|--------|
| `superAdmin` | Platform admin |
| `parent` | Family tenant admin / guardian |
| `teacher` | Academy member |
| `student` | Optional login linked to student profile |

## Data model (relational)

- `users` — Convex Auth users + app role
- `families` / `familyMembers`
- `academies` / `academyMembers`
- `students` — belongs to family; optional `userId`
- `familyAcademySubscriptions`
- `subjects` — taxonomy (STEM / humanities / life / applied)
- `courses` — native or external; owned by family or academy
- `modules` / `lessons` — native course structure
- `schedules` / `scheduleItems` — weekly planner with approval states
- `logs` — learning entries (native completion, external time, manual)

## Core flows (foundation)

1. Sign up / sign in (password) → role-based dashboard redirect
2. Parent lists students; creates log entries
3. Draft schedule → request approval → approved
4. Seed subjects taxonomy (admin / seed mutation)
5. Mock AI guardrails action + `/api/ai/guardrails` route

## UI principles

Extreme simplicity: minimal Tailwind, functional over pretty. Role-adaptive nav. No design system / purple themes.

## Out of scope (later)

- Clerk migration
- Real LLM provider wiring
- Rich planner calendar UI
- File upload UX for log attachments
- Full academy course marketplace
