# specs/ — Advisor → Implementer Handoff

This folder holds implementation specs written by the **advisor** (planning/review)
for the **implementer agent** (writes the code). One feature or update = one file.

## Workflow

1. Owner describes a feature/update to the advisor.
2. Advisor writes `specs/NNN-short-name.md` using the template below.
3. Implementer reads `AGENTS.md` first, then the spec, and implements it.
4. Implementer ticks the **Acceptance checklist**, fills in **Implementation notes**,
   and sets `Status: Done (<commit>)`.
5. Advisor reviews against the spec; follow-ups get a new spec or a "Revision" section.

## Rules for the implementer

- `AGENTS.md` constraints override anything in a spec. If a spec conflicts with
  `AGENTS.md`, stop and flag it in **Implementation notes** instead of guessing.
- Stay in scope. Anything listed under **Out of scope** must not be touched.
- Verify with `npm run build` (type-check). `npm run lint` is broken — don't use it.
- Update `AGENTS.md` / `PROJECT.md` / `README.md` / `UPDATE_PHASE.md` when the spec's
  **Docs to update** section says so.
- One spec = one commit (or a small, clearly-labelled series).

## Status values

`Draft` → `Ready` → `In progress` → `Done (<commit>)` · or `Blocked (<reason>)`

## Index

| # | Spec | Status |
|---|------|--------|
| 000 | [Baseline audit & doc drift](./000-baseline-audit.md) | Done |
| 001 | [News symbol tagging & active-asset filter](./001-news-symbol-filter.md) | Done |
| 002 | [Calendar impact & currency filter](./002-calendar-impact-currency-filter.md) | Done |
| 003 | [Reactive tick store (render isolation)](./003-reactive-tick-store.md) | Done |

**Recommended order:** 000 → 001 → 002 → 003 (the two small filters first, so the
large `page.tsx` refactor in 003 lands last and doesn't conflict).

---

## Spec template

```markdown
# NNN — Title

**Status:** Draft | Ready | In progress | Done (<commit>) | Blocked
**Priority:** P0–P4 · **Effort:** S / M / L
**Depends on:** NNN, …

## Goal
One or two sentences: what the user gets.

## Context
Why now, what exists today, relevant files (with paths).

## Requirements
Numbered, testable statements.

## Technical approach
Files to create/modify, data flow, APIs/endpoints, libraries (with justification
and version), pitfalls tied to AGENTS.md constraints.

## Out of scope
Explicit list of things NOT to do.

## Acceptance checklist
- [ ] `npm run build` passes
- [ ] …

## Docs to update
- AGENTS.md: …
- PROJECT.md / README.md / UPDATE_PHASE.md: …

## Implementation notes
(Implementer fills in: decisions, deviations, follow-ups.)
```
