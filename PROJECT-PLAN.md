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
│   │   │       ├── 002_seed_demo_tasks.sql
│   │   │       └── 003_create_audit_log.sql
│   │   ├── routes/
│   │   │   ├── tasks.routes.js
│   │   │   └── chat.routes.js
│   │   ├── controllers/
│   │   │   ├── tasks.controller.js
│   │   │   └── chat.controller.js
│   │   ├── services/
│   │   │   ├── tasks.service.js
│   │   │   ├── llm.service.js                    ← Claude API, tool definitions, confirm flow
│   │   │   └── audit.service.js                  ← audit_log reads/writes
│   │   ├── utils/
│   │   │   └── validation.js
│   │   └── middleware/
│   │       └── errorHandler.js
│   └── tests/
│       ├── tasks.test.js
│       ├── validation.test.js
│       └── audit.service.test.js
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
        │   ├── tasks.js
        │   └── chat.js
        ├── pages/
        │   ├── TasksPage.jsx          ← core task list (route "/")
        │   └── AssistantPage.jsx      ← chat UI (route "/assistant"), built in M4
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

-- 002_seed_demo_tasks.sql
INSERT INTO tasks (title, status, priority, due_date, tags) VALUES
  ('Escrever o RELATORIO.md', 'pending', 'high', '2026-09-08', '{relatorio}'),
  ('Ligar o endpoint /api/chat', 'pending', 'medium', '2026-09-12', '{backend,chatbot}'),
  ('Rever a interface no browser', 'completed', 'low', NULL, '{}'),
  ('Rever o pull request antes da entrega', 'pending', 'medium', '2026-09-15', '{revisao}');

-- 003_create_audit_log.sql
CREATE TABLE audit_log (
  id                 SERIAL PRIMARY KEY,
  source             TEXT NOT NULL DEFAULT 'chat',
  message            TEXT NOT NULL,
  tool_called        TEXT,
  tool_args          JSONB,
  result             JSONB,
  confirmation_token TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`audit_log` backs the chatbot extension and feature-roadmap item "audit trail" — every tool call the assistant makes (or proposes) is written here, `result IS NULL` marking a destructive call still waiting on user confirmation. The `automations` table sketched in an earlier draft of this plan (a `trigger`/`action` rules table) was dropped: nothing in M4 or the M5 feature-roadmap list actually consumes it, so it would have been unused scaffolding — cut per the project's own "don't build for hypothetical future requirements" rule rather than added just to match the original numbering.

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

**Chatbot extension (M4, implemented — runs on the DeepSeek API, not Claude):**
- `POST /api/chat` — `{ message }` → `{ reply, actions_taken: [{ tool, args, result }], requires_confirmation?: { confirmation_token, tool, args, summary } }`
  - Backed by `llm.service.js`: sends the message + tool definitions (`list_tasks`, `create_task`, `update_task`, `delete_task`) to the DeepSeek API via the official `openai` SDK pointed at `https://api.deepseek.com` (DeepSeek's chat-completions endpoint is OpenAI-compatible), model `deepseek-v4-flash`, function calling. Runs a small bounded loop (max 4 tool calls per message, `MAX_TOOL_HOPS`) rather than acting on only the first tool call — every provider tried so far (Claude, Gemini, DeepSeek) can call `list_tasks` to double-check a task before acting on it (e.g. "apaga a tarefa 9" triggers a `list_tasks` lookup, then `delete_task`), so a strict single-call design silently drops the actual action.
  - Provider history: built against Claude first (per the brief's own suggestion and this project's overall tooling), switched to Gemini to test against a different provider's key, then switched again to DeepSeek at the user's request — see `prompts-file.md` Entries 9-11 for the full story of each switch and what each one broke and fixed. Because the DeepSeek switch was done under an explicit "spend at most one real API call" constraint (the user was paying for it directly), verification there leaned on a single throwaway probe script confirming the exact response shape, code review against that confirmed shape, and the (free, provider-agnostic) confirm/cancel path — not a full live click-through like the Gemini pass got.
  - Non-destructive tools (`list_tasks`, `create_task`) execute immediately: the tool result is fed back to the model for a natural-language reply, and the call is logged to `audit_log` with its result. Tool args still go through the same `validateTaskFields`/`parseId` checks the REST API uses, so a malformed/hallucinated tool call fails cleanly instead of hitting Postgres directly.
  - Destructive tools (`update_task`, `delete_task`) are **not** executed — a row is written to `audit_log` with `result` left `NULL` and a random `confirmation_token` (UUID, `crypto.randomUUID()`), which is what's returned to the client, not the row's sequential `id` — a Security-review finding: a guessable integer would let anyone iterate small numbers and confirm/cancel *any* pending destructive action, which is a step up in risk from the plain CRUD API even in this no-auth take-home. The reply also spells out the actual field-by-field diff being proposed (e.g. `prioridade: "media" -> "alta"`), not just "update task #7?", per the same review. The system prompt explicitly tells the model to call the tool immediately and never ask for confirmation itself in plain text — without that instruction, a model would sometimes reply "are you sure?" without ever calling `delete_task`/`update_task` (seen live with Gemini), which defeats this whole mechanism since there'd be no tool call to intercept.
- `POST /api/chat/confirm` — `{ confirmation_token, confirm: boolean }` → `{ reply, actions_taken? }`. Looks up the pending `audit_log` row by token (must still have `result IS NULL`, else 404 — already resolved or unknown), executes the recorded tool+args only if `confirm: true`, and updates that row's `result` (or `{status:"cancelled"}`) — this is the feature-roadmap "confirmation before destructive action" item. If the target task no longer exists by the time it's confirmed, the reply says so honestly instead of claiming success (Review-QA caught this: the first version always replied "deleted/updated successfully" even when the delete/update was a no-op). This whole endpoint never calls the LLM API, so it's free to test regardless of which provider is configured.
- Returns 503 with a Portuguese message if `DEEPSEEK_API_KEY` isn't set (or is rejected as invalid, HTTP 401), instead of crashing the process — the core task app must keep working with no key configured. A failed call to the LLM API itself is logged with full detail server-side, then rethrown as a sanitized error to the client: a 429 (rate/quota limit) gets its own honest Portuguese message telling the user to try again later, anything else falls back to a generic 502.
- Accepted, not fixed, given the take-home's no-auth scope: `/api/chat` has no rate limiting, so any caller can trigger paid DeepSeek API calls with no cap beyond the 2000-character message-length check.

---

## 4. Docker

**docker-compose.yml** — three services: `db` (postgres:16-alpine, named volume, health check), `backend` (build `./backend`, depends on `db` healthy, reads `DATABASE_URL`/`DEEPSEEK_API_KEY`/`TZ` from `.env`/compose), `frontend` (build `./frontend`, dev server, depends on `backend`). One `docker compose up` brings up the whole stack — no local Postgres install needed.

**backend/Dockerfile** — Node LTS (Alpine) image, installs `tzdata` (needed for `TZ` to actually take effect — Alpine's Node image ships without timezone data by default), installs deps, runs migrations on start, `npm start`.

**frontend/Dockerfile** — Node LTS image running the Vite dev server directly (decided against a static nginx build — this is a local take-home demo, not a production deploy, so the dev server's simplicity and HMR win).

**.env.example:**
```
DATABASE_URL=postgres://postgres:postgres@db:5432/expressglass
PORT=3001
DEEPSEEK_API_KEY=
NODE_ENV=development
```

**Known gotchas hit and fixed (worth knowing before touching `vite.config.js`):**
- **Cross-container access needs `server.allowedHosts`.** Vite's dev server rejects any request whose `Host` header isn't `localhost`/the configured host (DNS-rebinding protection) — this silently 403'd requests from other containers on the compose network (e.g. a Playwright-based screenshot check hitting `frontend:5173`). Fixed with `allowedHosts: ['localhost', 'frontend']`.
- **HMR can miss file changes on a Windows bind mount.** Native filesystem change events don't reliably cross the Windows-host → Docker bind-mount boundary, so chokidar's default watcher silently missed edits, serving stale JS. Fixed with `server.watch: { usePolling: true, interval: 300 }`. If frontend edits ever stop showing up live again, this is the first thing to check.
- **Setting `TZ` on the backend shifted every `due_date` by a day while DST is active.** `TZ=Europe/Lisbon` was added so the chatbot's "what day is today" grounding (`buildSystemPrompt()`) is correct, but `pg` parses a `DATE` column into a JS `Date` at local midnight, and `res.json()` then serializes it via `.toISOString()` (UTC) — so any non-zero local offset (i.e. whenever Lisbon is in DST) pushed every due date back one calendar day. Fixed at the root in `backend/src/db/pool.js`: `types.setTypeParser(types.builtins.DATE, (v) => v)` returns the raw `'YYYY-MM-DD'` string instead of ever constructing a `Date` object, since a date-only column has no timezone to begin with. Covered by two tests in `backend/tests/tasks.test.js` that don't depend on which season they happen to run in.

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
3. **M2 — Frontend core ✅ verified + reviewed + styled + click-tested:** Vite dev server confirmed serving on `:5173`. Design mockup drafted (section 7) and implemented into the real app: global stylesheet, create form (title/priority/due date), status-toggle checkbox, priority badges, due dates, tag pills, empty state. Extended beyond the mockup with: a two-route split (`/` Tasks, `/assistant` a labeled M4 placeholder) via `react-router-dom` so future features don't crowd the core page; a full inline edit UI per task (title/priority/due date/tags) and a delete action behind a styled `ConfirmDialog`, since update/delete are treated as required here (section 3). Actually click-tested via a headless Playwright browser (not just curl) — screenshots confirmed visual fidelity to the mockup, and a scripted run drove real edit-save and delete-confirm clicks through the UI, verifying the changes landed in Postgres. Later extended with client-side status/priority filter dropdowns (`TaskFilters.jsx`) and a full Portuguese UI pass (all labels, badges, empty state, error messages, `<html lang="pt">`, `pt-PT` date formatting) — a deliberate choice given the exercise brief itself is Portuguese in origin.
4. **M3 — Report discipline check ✅:** `prompts-file.md` confirmed up to date (3 entries); `RELATORIO.md` drafted (bilingual EN/PT, matching `README.md`'s convention), distilling the 3 strongest prompt-log entries plus the required tools/models, accepted-vs-corrected breakdown, and the enum-cast SQL bug as the "AI mistake caught" example.
5. **M4 — Chatbot extension ✅ implemented + reviewed + live-verified:** `POST /api/chat` + `POST /api/chat/confirm`, tool definitions (`list_tasks`/`create_task`/`update_task`/`delete_task`) in `llm.service.js`, `audit.service.js`, migration `003_create_audit_log.sql`. Confirmation-before-destructive-action and the audit trail (M5 items 1-2) landed as part of this milestone rather than separately, since the chat feature needed them to be safe at all. `AssistantPage.jsx` rebuilt as a real chat UI (message bubbles, confirm/cancel buttons on pending destructive actions) replacing the M2 placeholder. Went through a Security + Review-QA subagent pass; fixes made as a result: destructive confirmations now use a random `confirmation_token` (not a guessable sequential id), the confirmation prompt discloses the actual field-by-field diff being proposed, tool arguments are validated the same way the REST API validates them before touching Postgres, upstream LLM API failures are wrapped instead of relaying raw error text, `errorHandler` no longer logs routine 4xx noise, and `/api/chat/confirm` gives an honest "nothing happened" reply instead of a false success when the target task no longer exists. Accepted without fixing, given the take-home's no-auth scope: `/api/chat` has no rate limiting. Built against Claude first, switched to the Gemini API (`@google/genai`) to test it live end-to-end with a real key, then switched again to the DeepSeek API (`openai` SDK against `https://api.deepseek.com`, model `deepseek-v4-flash`) at the user's request — see the note in section 3 and `prompts-file.md` Entries 9-11 for what each switch broke and fixed (Gemini: a stale model id, and the multi-hop tool-call/self-confirmation issues in section 3; DeepSeek: same multi-hop behavior confirmed again, this time verified with only one real paid API call plus the free confirm-path check, per an explicit "don't waste money" constraint). The Gemini pass was verified live end-to-end via curl and headless Playwright (create, list, update-with-confirm, delete-with-confirm, cancel); the DeepSeek pass relied on one probe call confirming the exact response shape plus code review, since further live calls would have cost real money. Live use of the chatbot also surfaced a pre-existing, chatbot-unrelated gap: `description` has been a real column on `tasks` and round-tripped through the API since M1, but no frontend surface (`TaskForm.jsx`, `TaskList.jsx`, the inline edit row) ever exposed it — the chatbot was simply the first thing to ever populate it with real content. Fixed by adding it to all three (`prompts-file.md` Entry 12).
6. **M5 — Feature roadmap ✅:** tags/priority (done in M2), confirmation-before-destructive-action + audit trail (done in M4). Last item, NL due dates: the chatbot was already resolving relative dates ("amanhã") correctly by luck — the system prompt never told it what day "today" actually was, so it was just guessing from its own training-time sense of "now," which isn't something to trust for a real feature. Fixed by computing the real current date server-side each request and grounding the system prompt with it explicitly (`buildSystemPrompt()` in `llm.service.js`, replacing the old static `SYSTEM_PROMPT` string) — the model still does the actual relative-date arithmetic ("amanhã" -> tomorrow's date), but now from a stated, correct anchor instead of an assumption. Caught and fixed a real latent bug along the way: computing "today" via `toISOString()` uses UTC, which is wrong once the server's UTC day and the user's local calendar day disagree (i.e. every evening/night in a timezone ahead of UTC); switched to reading `Date`'s local year/month/day instead, and set `TZ=Europe/Lisbon` on the backend service (plus `apk add tzdata` in `backend/Dockerfile`, since Alpine's Node image ships without timezone data by default) so "local" inside the container actually matches the user's real-world "today." Verified for free: the computed date/weekday inside the container now matches the user's actual local clock; the live chatbot behavior with this new grounding was not re-verified against the real DeepSeek API, per the same "don't spend API calls without asking" constraint from M4's DeepSeek switch.
7. **M6 — Polish ✅:** final README pass (fixed the stale "chatbot placeholder" wording on `/assistant`, now a real feature), a holistic Security + Review-QA subagent pass across the *whole* app together (not per-feature this time), and `RELATORIO.md` expanded with the chatbot/provider-switching story and its two best "AI mistake" examples. The holistic pass earned its keep: Review-QA caught a **critical, currently-live regression** from M5's `TZ` change — every `due_date` was coming back one calendar day early during Portugal's DST window (confirmed live: the seeded `2026-09-08` task returned `2026-09-08` in September, when DST is active), because `pg` was building a JS `Date` at local midnight from the `DATE` column and `res.json()` serialized it back to UTC. Fixed at the root (`backend/src/db/pool.js`, see section 4's gotcha list), not by reverting `TZ` (still needed for the chatbot's date grounding); added two regression tests that don't depend on the season they run in. Security's holistic pass separately caught that CORS was fully open (`cors()` with no options) combined with no auth and no rate limit on `/api/chat` — any local browser tab could have triggered paid DeepSeek calls; fixed by restricting to the actual frontend origin (`http://localhost:5173`). Also tightened: DeepSeek API errors are no longer logged as a raw object (status/message only). Smaller findings accepted as documented risk given the take-home's scope: a theoretical prompt-injection surface where chatbot-visible task content could influence which tool it calls next (destructive actions stay gated regardless), a loose `due_date` input format, and a benign TOCTOU race if the same confirmation token were confirmed twice concurrently.

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
