# PROJECT-PLAN — concrete structure for implementation

Companion to [expressglass-task.md](expressglass-task.md) (the general idea/decisions doc). This file is the concrete reference to scaffold and build from — directory tree, schema, API contract, Docker, MCP config, agents.

---

## 1. Directory tree

Reflects what actually exists as of M2 close-out; `(planned)` marks files that don't exist yet and belong to a later milestone.

```
(repo root)
├── CLAUDE.md                    ← project context for Claude Code
├── .mcp.json                    ← Context7 + Serena + Playwright MCP config
├── docker-compose.yml
├── .env.example / .env
├── .gitignore
├── RELATORIO.md                  ← process report (M3)
├── prompts-file.md               ← raw prompt log
├── .claude/
│   └── agents/
│       ├── product.md
│       ├── dev.md
│       ├── security.md
│       └── review-qa.md
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   ├── migrate.js
│   │   │   └── migrations/
│   │   │       ├── 001_create_tasks.sql
│   │   │       ├── 002_create_automations.sql   (planned — M4)
│   │   │       └── 003_create_audit_log.sql     (planned — M4)
│   │   ├── routes/
│   │   │   ├── tasks.routes.js
│   │   │   └── chat.routes.js                    (planned — M4)
│   │   ├── controllers/
│   │   │   ├── tasks.controller.js
│   │   │   └── chat.controller.js                (planned — M4)
│   │   ├── services/
│   │   │   ├── tasks.service.js
│   │   │   └── llm.service.js                    (planned — M4, Claude API + tool definitions)
│   │   ├── utils/
│   │   │   └── validation.js
│   │   └── middleware/
│   │       └── errorHandler.js
│   └── tests/
│       ├── tasks.test.js
│       └── validation.test.js
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                    ← router + nav shell
        ├── api/
        │   └── tasks.js
        ├── pages/
        │   ├── TasksPage.jsx          ← core task list (route "/")
        │   └── AssistantPage.jsx      ← chatbot placeholder (route "/assistant", built in M4)
        ├── components/
        │   ├── NavBar.jsx
        │   ├── TaskForm.jsx
        │   ├── TaskList.jsx
        │   └── ConfirmDialog.jsx      ← styled destructive-action confirm, replaces window.confirm
        └── styles/
            └── global.css
```

Plain JS/JSX throughout (no TypeScript) — an earlier draft of this tree showed `.ts`/`.tsx` files, which was aspirational and never matched what was actually scaffolded.

---

## 2. Database schema (PostgreSQL)

```sql
-- 001_create_tasks.sql
CREATE TYPE task_status AS ENUM ('pending', 'completed');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      task_status NOT NULL DEFAULT 'pending',
  priority    task_priority NOT NULL DEFAULT 'medium',
  due_date    DATE,
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 002_create_automations.sql
CREATE TABLE automations (
  id          SERIAL PRIMARY KEY,
  trigger     TEXT NOT NULL,
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 003_create_audit_log.sql
CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'chat',
  message     TEXT NOT NULL,
  tool_called TEXT,
  tool_args   JSONB,
  result      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`automations` and `audit_log` back the chatbot extension and feature-roadmap items 1-2 — skip them if the core-only scope is what ships.

---

## 3. API contract

**Core (required by the brief):**
- `GET /api/tasks?filter=pending|completed` — list tasks (any other/missing filter value returns everything)
- `POST /api/tasks` — `{ title, description?, due_date?, priority?, tags? }`

**Update/delete — bonus per the brief, but treated as required for this build:**
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id` — partial update
- `DELETE /api/tasks/:id`

Decision: the brief calls edit/delete optional, but both are fully built — API (implemented, 14 tests) *and* frontend UI: an inline edit form per task row (title/priority/due date/tags) and a delete action behind a styled confirmation dialog (`ConfirmDialog.jsx`, not the native `window.confirm`). Worth calling out explicitly in `RELATORIO.md` as a deliberate above-minimum choice, not scope creep — unlike the Trello-style stretch tier (section 10), this stayed inside the shape of the original CRUD app.

**Chatbot extension:**
- `POST /api/chat` — `{ message }` → `{ reply, actions_taken?: [{ tool, args, result }] }`
  - Destructive tools (`delete_task`, `update_task`) return a pending-confirmation state instead of executing immediately (feature-roadmap item 1); a follow-up confirm call executes it.
  - Every tool call is written to `audit_log` (feature-roadmap item 2).

---

## 4. Docker

**docker-compose.yml** — three services: `db` (postgres:16-alpine, named volume, health check), `backend` (build `./backend`, depends on `db` healthy, reads `DATABASE_URL`/`ANTHROPIC_API_KEY` from `.env`), `frontend` (build `./frontend`, dev server, depends on `backend`). One `docker compose up` brings up the whole stack — no local Postgres install needed.

**backend/Dockerfile** — Node LTS image, install deps, run migrations on start, `npm start`.

**frontend/Dockerfile** — Node LTS image running the Vite dev server directly (decided against a static nginx build — this is a local take-home demo, not a production deploy, so the dev server's simplicity and HMR win).

**.env.example:**
```
DATABASE_URL=postgres://postgres:postgres@db:5432/expressglass
PORT=3001
ANTHROPIC_API_KEY=
NODE_ENV=development
```

**Known gotchas hit and fixed (worth knowing before touching `vite.config.js`):**
- **Cross-container access needs `server.allowedHosts`.** Vite's dev server rejects any request whose `Host` header isn't `localhost`/the configured host (DNS-rebinding protection) — this silently 403'd requests from other containers on the compose network (e.g. a Playwright-based screenshot check hitting `frontend:5173`). Fixed with `allowedHosts: ['localhost', 'frontend']`.
- **HMR can miss file changes on a Windows bind mount.** Native filesystem change events don't reliably cross the Windows-host → Docker bind-mount boundary, so chokidar's default watcher silently missed edits, serving stale JS. Fixed with `server.watch: { usePolling: true, interval: 300 }`. If frontend edits ever stop showing up live again, this is the first thing to check.

---

## 5. MCP config (`.mcp.json`)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project", "."]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Requires `uv`/`uvx` installed locally for Serena. Exact args to confirm against Serena's current README when we scaffold (project mode vs. context flags may have changed). Playwright MCP ([docs](https://playwright.dev/docs/getting-started-mcp)) needs Node/npx available wherever Claude Code runs — gives agents real browser navigation/click/fill/screenshot instead of only static code reading.

---

## 6. Subagents (`.claude/agents/*.md`)

| Agent | Tools | Role |
|---|---|---|
| `product.md` | read-only | Defines requirements/acceptance criteria only, never writes code |
| `dev.md` | Read, Write, Edit, Bash | Implements backend/frontend code |
| `security.md` | read-only | Reviews for injection/input-validation issues, reports only |
| `review-qa.md` | Read, Bash | Runs tests, checks against Product's criteria, structured feedback (critical/warning/suggestion) |

`CLAUDE.md` at root holds: stack summary, conventions (e.g. parameterized queries only, no raw SQL string interpolation), how to run (`docker compose up`), and pointers to this file + the general-idea doc.

---

## 7. Design mockups (Claude Design skill)

Before styling the real frontend, use Claude Code's built-in `design` skill to draft a UI mockup as a separate, published Artifact (a `.dc.html` canvas, not part of the shipped repo) — a fast way to settle layout/typography/color decisions visually before writing the actual CSS.

- **First mockup:** "ExpressGlass Tasks Mockup" — static mockup of the core screen (header, add-task form, task list with status/priority-badge/due-date/tags, empty state). Aesthetic: clean/minimal internal-tool look, warm neutral palette, single indigo accent, Manrope type — chosen because the frontend had no pre-existing design system to match.
- This is a **reference only**, kept outside the git repo (Claude manages it as a hosted Artifact, listed via `/artifacts` in the Claude Code terminal). The actual deliverable is the styling applied to `frontend/src/**` afterward to match it.
- Worth a line in `RELATORIO.md`: this is a concrete example of using an AI-native design tool as part of the build process, not just code generation.
- Follow-up polish beyond the original mockup (not shown in the published Artifact, only in the running app): the two-route split, and the full edit/delete UI with a styled confirm dialog. See `prompts-file.md` Entries 4-5 for how these were verified (headless Playwright checks) and the two Vite/Docker bugs that surfaced and got fixed along the way.

---

## 8. Commit discipline

One commit per completed-and-reviewed milestone (see Build order below), not one giant commit at the end — so the git history itself documents the process for the report.

- **Never commit without asking first** — this convention sets the target cadence (one commit per milestone), it is not standing permission to actually run `git commit`. Propose the commit and its message at each milestone boundary and wait for a go-ahead before running it.
- Commit **after** a milestone's review pass (Security/Review-QA findings addressed), not immediately after first-draft implementation.
- Message style: imperative present tense summary line, focused on *why* the milestone mattered, not a changelog of files touched (e.g. `Add validation + normalize error responses after core review pass`, not `Update tasks.controller.js, errorHandler.js`).
- Every commit made by Claude Code ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- Before committing: `git status`/`git diff` review as usual — never `git add -A` blindly, given `.env` sits at repo root.

---

## 9. Build order (milestones)

1. **M0 — Scaffold ✅:** repo skeleton, `docker-compose.yml`, Dockerfiles, `.mcp.json`, `CLAUDE.md`, agent files, DB migration `001`.
2. **M1 — Backend core ✅ verified + reviewed:** `tasks` CRUD API implemented and confirmed live via `docker compose up` (create/list/get/patch/delete/404 all exercised with curl against real Postgres). Enum-cast bug found and fixed (`prompts-file.md` Entry 1). Went through a Security + Review-QA subagent pass afterward: added `backend/src/utils/validation.js`, normalized error responses to stop leaking raw Postgres errors, and replaced the placeholder test with 14 real unit + integration tests, all passing against live Postgres (`prompts-file.md` Entry 2).
3. **M2 — Frontend core ✅ verified + reviewed + styled + click-tested:** Vite dev server confirmed serving on `:5173`. Design mockup drafted (section 7) and implemented into the real app: global stylesheet, create form (title/priority/due date), status-toggle checkbox, priority badges, due dates, tag pills, empty state. Extended beyond the mockup with: a two-route split (`/` Tasks, `/assistant` a labeled M4 placeholder) via `react-router-dom` so future features don't crowd the core page; a full inline edit UI per task (title/priority/due date/tags) and a delete action behind a styled `ConfirmDialog`, since update/delete are treated as required here (section 3). Actually click-tested via a headless Playwright browser (not just curl) — screenshots confirmed visual fidelity to the mockup, and a scripted run drove real edit-save and delete-confirm clicks through the UI, verifying the changes landed in Postgres.
4. **M3 — Report discipline check ✅:** `prompts-file.md` confirmed up to date (3 entries); `RELATORIO.md` drafted (bilingual EN/PT, matching `README.md`'s convention), distilling the 3 strongest prompt-log entries plus the required tools/models, accepted-vs-corrected breakdown, and the enum-cast SQL bug as the "AI mistake caught" example.
5. **M4 — Chatbot extension:** `/api/chat`, tool definitions, `llm.service.js`, migrations `002`/`003`.
6. **M5 — Feature roadmap:** confirmation-before-destructive-action, audit trail, tags/priority, NL due dates — in that order, stopping whenever time runs out.
7. **M6 — Polish:** final README pass, Security/Review-QA agent pass, finish `RELATORIO.md`.

Core (M0-M2) is the non-negotiable deliverable; everything after M2 is additive and gets cut first if time is short. Commit after each milestone per section 8.

---

## 10. Stretch tier (post-core, tracked but not committed)

Beyond M5's small additions (tags/priority, NL due dates), a larger Trello-style direction has been raised: multiple boards, drag-and-drop between status columns, user accounts/auth, assigning tasks to people, and per-board permissions. Kept separate from the numbered milestones deliberately — this is a different-scale product (auth + multi-tenancy + real-time-ish drag state) than a take-home CRUD app, and attempting it risks not finishing M0-M4 cleanly. Only pick items up here after M0-M5 are solid and there's clear time left:

- Multiple boards (a `boards` table; tasks belong to a board instead of a single global list)
- Drag-and-drop status changes (columns = `pending`/`completed`, or a richer status set, reordered via a `position` column)
- User accounts (`users` table, session or JWT auth)
- Task assignment (`assignee_id` on `tasks`, referencing `users`)
- Board-level permissions (owner/member roles per board)

If any of these get built, log the decision and scope cut in `prompts-file.md`/`RELATORIO.md` the same as everything else — "recognized this was out of scope and deliberately deferred" is itself a good signal for the report.
