@AGENTS.md

# FindAGamesClub — Next.js rebuild

This is a ground-up rebuild of the existing FindAGamesClub application. The
original lives in `../app` (Python stdlib server + vanilla JS frontend) and is
kept as the **behavioural reference**: when you are unsure how a feature should
work, run it and click it rather than guessing.

Run the original: `cd ../app && python3 server.py` → http://127.0.0.1:4173/clubs-v2/directory-v2
Run this one: `npm run dev` → http://localhost:3000

Both can run at once. Port 4173 vs 3000.

## Stack

Next.js 16 (App Router) · React 19 · Material UI 9 · Supabase (Postgres, Auth,
Storage) · Resend (email) · Vercel (hosting).

## Gotchas already discovered — do not relearn these

**Next.js 16 differs from most training data.** `AGENTS.md` says to read
`node_modules/next/dist/docs/` before writing code. Specifically:

- `middleware.ts` is renamed to **`proxy.ts`**, exporting a function named
  `proxy`. Supabase's own docs still say middleware. Ours is `src/proxy.ts`.
  The proxy runtime is Node.js and cannot be set to `edge`.
- `cookies()`, `headers()`, `params` and `searchParams` are **async only**.
  Synchronous access was removed, not deprecated. This is why
  `src/lib/supabase/server.ts` exports an async `createClient()`.
- Use the generated `PageProps<...>` / `LayoutProps<...>` type helpers.

**Material UI 9 dropped system props on `Typography`.** `fontWeight`, `mt` and
similar must go through `sx`. TypeScript catches it.

**Supabase cookie API.** Use `getAll` / `setAll`. The `get` / `set` / `remove`
form is deprecated and causes random logouts.

**Theme is light only.** No dark mode, by decision. Do not reintroduce
`colorSchemes`, `cssVariables` or `InitColorSchemeScript`. Colours, type and
spacing all come from `src/theme.ts` — never hardcode a palette value in a
component, and keep `globals.css` free of colours and fonts so it cannot
override the theme.

**Verify from the right directory.** Shell sessions can reset to the repo
parent. Always `cd` into this folder in the same command as the check, or you
will get false passes.

## Design skills — use these, do not freehand the UI

Three skills live in `.claude/skills/` and are part of this project on purpose.
UI quality is a paid deliverable here, not a nice-to-have.

- **`frontend-design`** — read this *before* creating a new page or reshaping an
  existing one. It covers aesthetic direction and typography, and how to avoid
  output that reads as templated Material defaults. This is the main risk with
  MUI: everything looks like everyone else's admin panel.
- **`ui-ux-pro-max`** — use for concrete decisions: colour systems, font
  pairings, spacing, interaction and hover states, accessibility, component
  patterns, and per-product-type layout conventions. Good for "what should this
  table/form/card actually do".
- **`humanizer`** — use for any prose that a human will read: client updates,
  README and handover docs, and in-product copy such as empty states, error
  messages and email templates. Strips AI writing tells.

Default expectation: a page should look considered and specific to this product,
not like the MUI documentation with a different primary colour.

## Structure

```
src/app/            routes (App Router)
src/components/     shared React components
src/lib/supabase/   client.ts (browser) · server.ts (RSC/actions/routes)
src/lib/db/         data access
src/types/          shared TypeScript types
src/theme.ts        the single source of truth for design tokens
src/proxy.ts        Supabase session refresh (Next 16's middleware)
```

## Environment

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_*` values reach the browser —
only put public things there. The Supabase **service role key** and the Resend
API key must never be prefixed with `NEXT_PUBLIC_`.

Supabase dev project: `findagamesclub-bot` (`hpiqdqrzmhvwnplotfnn`), eu-west-2.
Treat it as disposable during migration; production is a separate project.
