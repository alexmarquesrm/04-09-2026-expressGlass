# PROJECT-PLAN — concrete structure for implementation

Companion to [expressglass-task.md](expressglass-task.md) (the general idea/decisions doc). This file is the concrete reference to scaffold and build from — directory tree, schema, API contract, Docker, MCP config, agents.

---

## 1. Directory tree

```
(repo root)
├── CLAUDE.md                    ← project context for Claude Code
├── .mcp.json                    ← Context7 + Serena MCP config
├── docker-compose.yml
├── .env.example
├── RELATORIO.md                 ← filled in as we build
├── prompts-file.md               ← raw prompt log
├── .claude/
│   └── agents/
│       ├── product.md
│       ├── dev.md
│       ├── security.md
│       └── review-qa.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── migrations/
│   │   │       ├── 001_create_tasks.sql
│   │   │       ├── 002_create_automations.sql
│   │   │       └── 003_create_audit_log.sql
│   │   ├── routes/
│   │   │   ├── tasks.routes.js
│   │   │   └── chat.routes.js
│   │   ├── controllers/
│   │   │   ├── tasks.controller.js
│   │   │   └── chat.controller.js
│   │   ├── services/
│   │   │   ├── tasks.service.js
│   │   │   └── llm.service.js       ← Claude API + tool definitions
│   │   └── middleware/
│   │       └── errorHandler.js
│   └── tests/
│       └── tasks.test.js
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   └── tasks.ts
        ├── components/
        │   ├── TaskList.tsx
        │   ├── TaskForm.tsx
        │   └── ChatPanel.tsx
        └── styles/
```

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

**Core (required):**
- `GET /api/tasks?filter=pending|completed|all` — list tasks
- `POST /api/tasks` — `{ title, description?, due_date?, priority?, tags? }`

**Bonus:**
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id` — partial update
- `DELETE /api/tasks/:id`

**Chatbot extension:**
- `POST /api/chat` — `{ message }` → `{ reply, actions_taken?: [{ tool, args, result }] }`
  - Destructive tools (`delete_task`, `update_task`) return a pending-confirmation state instead of executing immediately (feature-roadmap item 1); a follow-up confirm call executes it.
  - Every tool call is written to `audit_log` (feature-roadmap item 2).

---

## 4. Docker

**docker-compose.yml** — three services: `db` (postgres:16-alpine, named volume, health check), `backend` (build `./backend`, depends on `db` healthy, reads `DATABASE_URL`/`ANTHROPIC_API_KEY` from `.env`), `frontend` (build `./frontend`, dev server, depends on `backend`). One `docker compose up` brings up the whole stack — no local Postgres install needed.

**backend/Dockerfile** — Node LTS image, install deps, run migrations on start, `npm start`.

**frontend/Dockerfile** — Node LTS image for the Vite/CRA dev server (or a static build served by nginx if we want a lighter final image — decide at build time).

**.env.example:**
```
DATABASE_URL=postgres://postgres:postgres@db:5432/expressglass
PORT=3001
ANTHROPIC_API_KEY=
NODE_ENV=development
```

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
    }
  }
}
```

Requires `uv`/`uvx` installed locally for Serena. Exact args to confirm against Serena's current README when we scaffold (project mode vs. context flags may have changed).

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

---

## 8. Commit discipline

One commit per completed-and-reviewed milestone (see Build order below), not one giant commit at the end — so the git history itself documents the process for the report.

- Commit **after** a milestone's review pass (Security/Review-QA findings addressed), not immediately after first-draft implementation.
- Message style: imperative present tense summary line, focused on *why* the milestone mattered, not a changelog of files touched (e.g. `Add validation + normalize error responses after core review pass`, not `Update tasks.controller.js, errorHandler.js`).
- Every commit made by Claude Code ends with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer.
- Before committing: `git status`/`git diff` review as usual — never `git add -A` blindly, given `.env` sits at repo root.

---

## 9. Build order (milestones)

1. **M0 — Scaffold ✅:** repo skeleton, `docker-compose.yml`, Dockerfiles, `.mcp.json`, `CLAUDE.md`, agent files, DB migration `001`.
2. **M1 — Backend core ✅ verified + reviewed:** `tasks` CRUD API implemented and confirmed live via `docker compose up` (create/list/get/patch/delete/404 all exercised with curl against real Postgres). Enum-cast bug found and fixed (`prompts-file.md` Entry 1). Went through a Security + Review-QA subagent pass afterward: added `backend/src/utils/validation.js`, normalized error responses to stop leaking raw Postgres errors, and replaced the placeholder test with 14 real unit + integration tests, all passing against live Postgres (`prompts-file.md` Entry 2).
3. **M2 — Frontend core ✅ verified + reviewed + styled:** Vite dev server confirmed serving on `:5173`; create-task form + list view wired to the API. Fixed a missing `catch` around `onCreate` in `TaskForm.jsx` found in the same review pass. Design mockup drafted (section 7) and implemented into the real app: global stylesheet, extended create form (priority + due date), status-toggle checkbox wired to `PATCH /api/tasks/:id`, priority badges, due dates, tag pills, empty state — confirmed working end-to-end via curl against the live API (not yet click-tested in an actual browser).
4. **M3 — Report discipline check:** confirm `prompts-file.md` has been kept up to date so far; start drafting `RELATORIO.md`.
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
