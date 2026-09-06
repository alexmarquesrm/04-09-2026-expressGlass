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

Beyond M5's small additions (tags/priority, NL due dates), a larger Trello-style direction has been raised: multiple boards, drag-and-drop between status columns, user accounts/auth, assigning tasks to people, and per-board permissions. Kept separate from the numbered milestones deliberately — this is a different-scale product (auth + multi-tenancy + real-time-ish drag state) than a take-home CRUD app, and attempting it risks not finishing M0-M4 cleanly. Built as new, additive tables/routes/pages only — the existing `tasks`/`audit_log` tables, existing routes, and existing Tasks/Assistant pages are untouched. Each item gets the same Security + Review-QA pass as M0-M6 before moving to the next:

- **S1 — Multiple boards ✅:** new `boards`/`board_tasks` tables (migrations 004/005, `board_tasks` reusing the `task_status`/`task_priority` enums from 001), full CRUD services/controllers/routes under `/api/boards`, a Quadros nav link, and `/boards` + `/boards/:id` pages (two-column Pendente/Concluída view). Security review found no SQL injection or cross-board IDOR; Review-QA confirmed cascade delete, board-scoping, and the M6 timezone fix all work correctly on the new `due_date` column, and 31/31 tests pass. Both reviews flagged the same gap — `position` (added for S2) had zero validation, a live `PATCH` with a non-numeric value returned a raw 500 — plus a UX inconsistency: board/task delete skipped the app's established `ConfirmDialog` pattern and went straight to a one-click destructive call. Fixed: `position` validated as a non-negative integer, delete actions now go through `ConfirmDialog`, stale error banners now clear on the next successful action, and a board that 404s no longer sticks on "A carregar..." forever. Left as documented risk: cascade-deleting a board has no audit-log entry, worth revisiting once S3 adds ownership.
- **S2 — Drag-and-drop ✅:** native HTML5 drag-and-drop on `BoardDetailPage.jsx` (no new dependency) — dropping a card reorders it within a column or moves it across columns, recomputing `position` as `index * 10` for the affected column(s) and persisting via one `PATCH` per changed task. Caught and fixed an off-by-one during my own testing (dropping a card "before" a same-column target inserted it after instead, since the target's index didn't account for the dragged item's own removal from the list). Security review found no IDOR/injection risk in the new batched-PATCH call pattern; Review-QA verified same-column reorder, cross-column move, the "Mover para X" button and drag-and-drop mixing safely, and reload-persistence, all live against the real API. Both reviews converged on the same fragility: a failed PATCH mid-batch reverted the whole UI to its pre-drag snapshot instead of reconciling with the server, which could go stale once S3 adds a new failure mode (expired sessions). Fixed: failure now re-fetches from the server instead of blindly reverting; also fixed a possible stale-closure race on rapid successive drags (now reads from a ref instead of render-scoped state), skip redundant PATCHes when a drop is a no-op, gave newly created board tasks a real initial `position` instead of always `0`, and clamped `position`'s upper bound to match the Postgres `INTEGER` column.
- **S3 — User accounts / auth ✅:** new `users` table (migration 006), JWT-in-httpOnly-cookie auth (`jsonwebtoken` + `bcryptjs`, chosen over a session store to avoid adding Redis for a take-home), `/api/auth/register|login|logout|me`, and a `requireAuth` middleware exported for S4/S5 to reuse. Deliberately does **not** gate the existing `/api/tasks`/`/api/boards`/`/api/chat` routes yet — that's S5's explicit job. Frontend gets `/login`/`/register` pages, an `AuthContext` that restores the session via `/api/auth/me` on load, and the nav bar shows "Olá, <name>" + logout, or login/register links. Security review found the core mechanics solid (JWT actually verified not just decoded, parameterized queries, no secrets leaked, cookie flags correct) with two proportionate, accepted-as-documented-risk items: a login timing side-channel (a nonexistent email skips bcrypt entirely, making it measurably faster to reject than a wrong password on a real account) and no rate-limiting on `/api/auth/login`/`register` (consistent with the app's existing no-rate-limit stance elsewhere, e.g. `/api/chat`). Review-QA found one real **Critical**: the register endpoint's duplicate-email pre-check (`findUserByEmail` before `INSERT`) had a TOCTOU race — confirmed live by calling `createUser` twice concurrently for a brand-new email, which reliably reproduced an unhandled Postgres `23505` unique-violation surfacing as a raw 500 instead of the intended 409. Fixed by catching `23505` in `authService.createUser` itself and translating it to the same 409 the pre-check path already returns, re-verified with both a concurrent-service-call regression test and a live burst of 5 simultaneous HTTP register requests for one email (1×201, 4×409, zero 500s). Also fixed two smaller QA findings: the cookie's `secure` flag was hardcoded `false` instead of gated on `NODE_ENV`, and `logout`'s `clearCookie` call used a separately hand-typed options object instead of deriving from the same `COOKIE_OPTIONS` used to set the cookie (a latent footgun if the two ever drifted).
- **S4 — Task assignment ✅:** `assignee_id` added to `board_tasks` (migration 007, `ON DELETE SET NULL` so deleting a user unassigns their tasks rather than blocking the deletion or cascading), a new unauthenticated `GET /api/users` endpoint to populate the assignment picker, and `boardTasks.service.js` rewritten to LEFT JOIN `users` so list/get responses carry an `assignee_name` alongside `assignee_id`. Frontend gets an assignee dropdown on both the task-creation form and each task card (reassign/unassign inline) on `BoardDetailPage.jsx`. Deliberately kept on `board_tasks`, not the original core `tasks` table — assignment is a boards-era concept and the core deliverable stays untouched. Along the way, found and fixed a real gap in the test suite itself: `auth.test.js` had never cleaned up the users it created, silently accumulating junk rows in the dev DB across every test run; fixed with a `test.after` cleanup, same convention `boards.test.js` already used. Security and Review-QA both flagged the same real (if proportionate) issue: the new `GET /api/users` handed out every registered user's email address with zero authentication — a step beyond the app's existing "no auth on boards/tasks" gap, since it's specifically a PII field. Fixed by dropping `email` from that response (the picker only needs `id`+`name`). Review-QA separately caught a latent bug in the new FK-violation handling: `throwIfInvalidAssignee` blamed *any* Postgres foreign-key violation on `assignee_id`, which would have produced a misleading error message if `board_tasks`'s other FK (`board_id`) were ever violated through this path (not reachable today since the controller's `requireBoard()` already 404s first, but a real trap for future code) — fixed by checking `err.constraint` before attributing the error. Both reviews confirmed the SQL-injection/IDOR/cross-board-scoping properties held up through the service-layer rewrite.
- **S5 — Board-level permissions ✅ (final stretch-tier item):** new `board_members` table (migration 008: composite PK `(board_id, user_id)`, an `owner`/`member` role enum, cascading FKs to both `boards` and `users`). `boards.service.js`'s `createBoard` now takes an `ownerId` and wraps the board INSERT plus the creator's owner-membership INSERT in one transaction, so a board can never exist without an owner. New `requireBoardMember`/`requireBoardOwner` middleware (`boardAccess.middleware.js`) gate every board and nested board-task route: `GET /api/boards` now only lists boards the caller belongs to; `GET`/task-CRUD need any membership; `PATCH`/`DELETE` on the board and member-management writes need `owner`. New `GET/POST /api/boards/:id/members` and `DELETE /api/boards/:id/members/:userId` for managing who's on a board. Frontend: `/boards`/`/boards/:id` now require login, `BoardDetailPage.jsx` shows a distinct 403 ("Não tens acesso a este quadro") vs 404 ("Quadro não encontrado") state, and a Membros panel (owner-only add/remove controls). Verified live end-to-end with two independent real accounts before either review ran: cross-user 403s, membership grants/revokes access immediately, owner-vs-member action boundaries, and the last-owner-removal guard.
  - Security reviewed this as the authorization-critical slice and found the core model sound (no IDOR via route/param confusion, no privilege escalation via the member-add endpoint since it's owner-gated, the creation transaction is atomic with no connection leak, full SQL parameterization) but flagged two real gaps: a TOCTOU race on the "last owner" protection (two concurrent requests could both pass an owner-count check before either commits — same class of risk as S3's accepted register race, but reachable through two completely ordinary requests rather than needing malicious intent), and `assignee_id` (from S4) being validated only against "does this user exist," not "is this user a member of the board the task belongs to" — now that `board_members` exists specifically to answer that question.
  - Review-QA went further and found a **Critical** that Security's angle didn't surface: `POST /api/boards/:id/members` upserts a member's role with zero last-owner guard (only the `DELETE` path had one), so a board's sole owner could demote themselves to `member` in a single ordinary API call — no race, no malicious intent required, e.g. a wrong dropdown selection in the members UI — permanently orphaning the board with no recovery path via the API. QA correctly diagnosed *why* it shipped: all 62 tests at that point were service-level unit tests; nothing exercised the actual HTTP routes/middleware chain, which is exactly the layer the bug lived in.
  - Fixed all three: added the same last-owner check to the `POST /members` path, then hardened *both* the add and remove paths against the underlying race Security flagged by wrapping each in a transaction that row-locks the board's membership rows before checking the owner count (`boardMembers.service.js`'s `withBoardMembersLocked`/`upsertMemberRoleSafely`/`removeMemberSafely`) — closing the TOCTOU properly rather than leaving a second partial guard. Added `assertAssigneeIsBoardMember` so S4's assignment now requires the assignee to actually be on the board (existing tests updated to add the assignee as a member first, since that's now a real precondition). Directly addressed QA's root-cause diagnosis by adding `supertest` and a new `backend/tests/boardAccess.test.js` — real HTTP requests through the actual Express app (`server.js` now guards its `app.listen()` behind `require.main === module` so requiring it from tests doesn't try to bind the port) covering every cross-user/role boundary, including a regression test that reproduces the exact bug QA found. Re-verified the fix live against the real running server, not just the test harness. 71/71 tests passing.
  - Explicitly accepted as documented, out-of-scope risk (not fixed): `GET /api/users` remains unauthenticated (pre-existing from S4, now also used to populate the board-members picker) and the original `/api/tasks`/`/api/chat` routes remain completely unauthenticated by design — gating the core deliverable was never in scope (CLAUDE.md: "Core... is the non-negotiable deliverable"), and S5's access control is additive to boards only, per the plan's own sequencing. Also noted: deleting a *user account* (not a board member via the API, which is now guarded, but the `users` row itself) still cascades through `board_members` with no last-owner protection — currently unreachable since the app has no account-deletion endpoint at all, so this is a theoretical DB-level gap, not one reachable through the running app's actual surface.

This completes the full stretch tier (S1-S5).

If any of these get built, log the decision and scope cut in `prompts-file.md`/`RELATORIO.md` the same as everything else — "recognized this was out of scope and deliberately deferred" is itself a good signal for the report.

---

## 11. Post-stretch polish: default seed data + Trello-style visual pass

With the stretch tier complete, the user asked for two more things before considering the app demo-ready: seed the whole database (not just the 4 sample core tasks from M0) so `/boards` isn't empty either, and a visual polish pass making the boards UI feel closer to the Trello screenshots referenced as the target look.

- **Seed migration `009_seed_default_data.sql`:** 4 default users (Ana, Bruno, Carla, Diogo), 3 boards, `board_members` rows mixing owner/member roles across them, and a handful of `board_tasks` with varied status/priority/assignees — so every S5 access-control path (owner vs. member, cross-board isolation) has real data behind it out of the box, not just an empty shell. All 4 users share one bcrypt hash for the password `password123`, generated once via the app's own `bcryptjs` (`docker compose exec backend node -e "..."`) and pasted into the migration as a literal — no `pgcrypto` extension needed, consistent with the "no ORM, plain SQL migrations" convention. Applying it against the live dev DB surfaced a genuine, easy-to-miss Postgres typing gotcha: bare string/date/array literals inside a `UNION ALL` feeding an `INSERT ... SELECT` don't auto-coerce to the target column's type (enum, `date`, `text[]`) the way a plain single-row `INSERT ... VALUES` would — fixed by adding explicit `::board_role`, `::task_status`, `::task_priority`, `::date`, `::text[]` casts on every branch. Verified live via curl (logged in as the seeded `ana@expressglass.dev`, confirmed her board list and roles matched the seed exactly) rather than just trusting the migration ran without error. Documented the 4 logins in `README.md` (both language sections) so they're discoverable without reading a migration file.
- **Visual polish pass:** `/boards` is now a grid of gradient-banner tiles (color deterministically hashed from the board id via a small new `frontend/src/utils/color.js`) instead of a flat list of rows, with a dashed "+ Criar quadro" create-tile in place of the old plain form — matching the Trello reference directly. The board detail page gained a colored hero banner (same hash, so a board's color is consistent between the grid and its own page) and a small `Avatar` component (colored circle, initials from name) used for board members and task assignees. The nav bar gained a brand mark (an "E" logomark + "ExpressGlass" wordmark) next to the existing pill nav, and the login/register pages got the same mark above their forms for consistency.
- **Design canvas (Claude Design skill):** before building the next slice, the floating assistant widget and the custom-column board were drafted as a 3-artboard design canvas (board page with columns + the floating button; the assistant panel open/closed including its confirm-before-destructive state; column anatomy — rename/delete menu, in-column card composer, add-column states), matching the app's real tokens lifted from `global.css` rather than inventing a new look. Published at https://claude.ai/code/artifact/7625d983-3c4c-413a-80e4-4234d90a0f49. Note for the report: the skill's helper needs `node`, which isn't installed on the host — it was run unmodified inside the frontend container (the repo is bind-mounted there), rather than improvising a substitute. Deviations made deliberately during implementation: the card's assignee and column controls are real `<select>`s on one row (keyboard/touch-accessible card moves, which a drag-only design loses), and chat messages stack from the top rather than bottom-anchored (correct for a panel that actually scrolls).
- Two rounds of Playwright-driven visual QA (screenshots of the actual running app, not just "it compiles") caught real if minor issues each time: the first round found 2 of the 8 gradient-palette entries both read as purple (fixed by swapping one to cyan) and that the pencil/trash icon buttons on task rows had no visible affordance at rest — only on hover — which now looked inconsistent next to the new always-visible board-tile delete button; fixed by giving the shared `.icon-btn` class a permanent 1px-border white-chip look, matching the border language already used elsewhere (`.field`, `.badge-priority`). A second screenshot round re-verified both fixes read well in context (including on hover, and sitting on top of a colored gradient banner) before considering this done.

---

## 12. Custom columns + an assistant that can actually run the board

The last functional gap: the assistant lived on its own tab and could only touch the original personal task list, and a board's columns were the two hardcoded statuses. Three changes, one slice:

- **Columns are real rows** (migration 010): a `board_columns` table, `board_tasks.column_id` (NOT NULL after a backfill that gave every existing board `A fazer`/`Em curso`/`Concluído` and placed existing cards by their old status), `boardColumns.service.js` with a `SELECT ... FOR UPDATE` delete guard (mirroring S5's last-owner pattern: can't delete the last column of a board, can't delete a column that still holds cards), and `/api/boards/:id/columns` routes — members can add/rename, only owners can delete. `board_tasks.status` was deliberately kept (API compatibility, existing tests) but no longer places a card; a card's column is what does. Frontend: `BoardDetailPage.jsx` rewritten around fetched columns, with per-column card composers, an inline column rename, an add-column tile, and drag-and-drop rekeyed from `status` to `column_id`.
- **The assistant is a floating button, not a tab** (`ChatWidget.jsx`, mounted globally in `App.jsx`; the Assistente nav item and `AssistantPage.jsx` are gone). It only renders when logged in, because it now acts *as* the logged-in user.
- **The assistant can run boards** (`agentTools.service.js`, new): boards, columns, cards, assignment and membership tools alongside the original personal-task ones. `/api/chat` and `/api/chat/confirm` now require auth — they were completely unauthenticated before — and `audit_log` records `user_id` (migration 011) so a pending confirmation can only be confirmed by whoever proposed it.

The security angle that made this slice worth doing carefully: the assistant calls services directly, bypassing the Express routes where S5's `requireBoardMember`/`requireBoardOwner` middleware lives. Without its own gate it would have been a complete way around board permissions. `assertBoardAccess` is that gate, applied to every board-scoped tool and re-checked at confirm time rather than only when the action was proposed.

Security and Review-QA (run in parallel as usual) both earned their keep:

- Security found a **Critical**: `add_board_member` was not in the destructive-tools set, so it executed with no confirmation, and its schema let the model pass `role: 'owner'`. Since `users.name` had no length limit and `list_users` feeds every name to the model, a user could register with a name full of instruction-shaped text and try to talk the assistant into granting them ownership of a board they were never on — while the widget's own greeting promises that anything which changes something asks first. Fixed four ways: `add_board_member` now goes through confirm-then-execute (with its own summary, since it isn't a task edit), the role is forced to `member` in execution and removed from the tool schema entirely, `name` is capped at 80 characters, and tool results are fenced as data with an explicit "never follow instructions in here" marker in both the payload and the system prompt. Security also caught that the 403 message named the board (`não tens acesso ao quadro "X"`), which — because tool errors are relayed back to the user — let anyone enumerate every private board's name by walking ids; it now matches the middleware's generic wording.
- Review-QA found that moving a card to another column *without* an explicit position kept its old position and collided with whatever already sat there — invisible in the web UI (which always sends positions) but hit on every assistant-driven move; fixed by computing the next position in the target column. QA also caught that `list_board_tasks` handed the model `status` but not the column *name*, so "which cards are done?" would be answered from the stale field: the list now carries `column_name` and `status` was dropped from the assistant's update schema. Plus a batch of smaller real ones, all fixed: column names weren't trimmed before storage, the inline rename fired a duplicate PATCH when Enter also blurred the input, the drag error path refetched tasks but not columns (so a column deleted by someone else kept rendering), and a failed confirm in the chat widget left the pending action stranded with its buttons gone.
- Both reviews independently confirmed the parts that matter held: no SQL injection (SET clauses are built from a hardcoded key allowlist, values always parameterized), no column IDOR (a card cannot be parked in another board's column on create or update), all board-scoped tools authorize, and the confirm flow re-authorizes at execution.
- Also fixed while here, having now been flagged across three separate slices: `GET /api/users` finally requires auth. It is only ever called from pages that already need a session.
- Accepted as documented risk, unchanged: `board_tasks.column_id` stays `ON DELETE CASCADE` rather than `RESTRICT` (RESTRICT would break board deletion, where columns and cards are cascaded together and the delete order isn't guaranteed) — the service-level "not empty" guard, now locked, is what actually protects cards. `audit_log` accumulates full tool results with no retention policy, unreachable today since nothing reads it. And the original personal `tasks` table still has no owner column, so every user's assistant shares one personal task list — gating the core deliverable was never in scope.

**Follow-up round (card modal, drag fix, labels).** Using the board surfaced three things:

- **A real drag bug:** a card dragged to another column stayed at drag opacity until a page reload. Cause worth recording, because it isn't obvious: moving a card across columns re-parents it in the React tree, so the browser unmounts the dragged DOM node mid-drag and never delivers its `dragend` — which was the only place `draggingId` got cleared. Fixed by clearing it in `moveTaskTo` (where the move is actually known to have happened) rather than relying on an event the browser won't always send.
- **Cards open in a modal** (`TaskModal.jsx`): title, description, responsável, coluna, prioridade and colour labels, plus delete. The card face lost its inline selects and now reads like a real board card — colour chips, title, priority badge, due date, assignee avatar — with the whole card being the button that opens the modal. Moving a card without dragging stayed possible (the modal's Coluna select), so the keyboard/touch path wasn't traded away for the cleaner face.
- **Colour labels** (migration 012): `board_tasks.labels TEXT[]`, validated against a fixed six-colour palette rather than free text or hex, so the UI owns what each key looks like and stored data never needs rewriting to restyle them.

Verified in a real browser end-to-end, and the drag test is the interesting one: it dispatches genuine HTML5 `DragEvent`s with a shared `DataTransfer` and **deliberately never dispatches `dragend`**, reproducing exactly the condition that caused the bug — a synthetic mouse drag doesn't fire HTML5 drag events at all, and a test that helpfully fires `dragend` would have passed against the broken code. Also checked: six columns overflow into a horizontal scroller (1874px of content in a 1192px strip) while the page itself does not scroll sideways and every column keeps its 280px width; modal edits persist across a reload; Escape closes without saving. 96 tests pass, including HTTP-level tests for the column routes written from the start this time (the S5 lesson), for the confirm flow's cross-user rejection and single-use claim, and for label round-tripping and palette rejection.

No assistant message has been sent at any point, because a real DeepSeek key is configured and each call costs money — the tool layer is tested directly instead, so the LLM's own behaviour against these tools remains unproven.
