# Prompts File — raw AI-usage log

Kept in real time while building the ExpressGlass take-home challenge, so the final `RELATORIO.md` doesn't have to be reconstructed from memory. Maps directly to what the exercise brief asks the process report to cover:

- Which AI tools/models were used
- 2-3 example prompts, with the result obtained
- What was accepted as-is vs. corrected/rejected, and why
- Any moment the AI produced something incorrect or strange, and how it was noticed

At the end, the 2-3 strongest entries below get promoted into `RELATORIO.md`; this file stays as the full unfiltered log.

---

## AI tools/models used

- Claude Code (Sonnet 5) — main development agent, subagent orchestration
- Context7 MCP — live library documentation lookup
- Serena MCP — semantic code navigation/editing
- Anthropic Claude API — powers the in-app chatbot extension (tool use / function calling)

---

## Log entries

Copy the block below for each new prompt worth recording (not every trivial one — the ones that show a real decision, correction, or catch).

```
### Entry N — <milestone, e.g. M1 backend core> — <date>

**Prompt (exact):**
> ...

**Result obtained (summary):**
...

**Accepted / Corrected / Rejected:**
...

**Why:**
...

**AI mistake or oddity noticed?**
...
```

<!-- Entries start here -->

### Entry 1 — M0/M1 scaffold — 2026-09-05

**Prompt (exact):**
> lets start the project with docker files

**Result obtained (summary):**
Claude Code scaffolded the whole repo in one pass: `CLAUDE.md`, `.mcp.json`, `.claude/agents/*.md` (product/dev/security/review-qa), a full Express backend (`tasks` CRUD across routes → controllers → services, parameterized SQL, shared `errorHandler`, a startup migration runner), a minimal Vite+React frontend (task form + list wired to `api/tasks.js`), and a three-service `docker-compose.yml` (Postgres + backend + frontend). It was upfront that Docker/Node weren't available in its own environment, so none of it had actually been run yet.

**Accepted / Corrected / Rejected:**
Structure, layering, and conventions accepted as-is (they matched CLAUDE.md). One bug had to be corrected — see below.

**Why:**
The scaffold matched the plan in `PROJECT-PLAN.md` closely enough that re-deriving it by hand would have taken longer than reviewing the generated code.

**AI mistake or oddity noticed?**
Yes — a real bug, not just style. `POST /api/tasks` failed on the very first live test with `column "priority" is of type task_priority but expression is of type text`. The generated SQL was `COALESCE($4, 'medium')` inside an insert into an enum column (`task_priority`); Postgres can't infer that a bound parameter inside `COALESCE` should be cast to the enum type, so it defaulted to `text` and the insert failed. This only surfaced once the container was actually running against real Postgres — it wasn't visible from reading the code, since the query looks correct at a glance. Fixed by adding explicit casts: `COALESCE($4::task_priority, 'medium')` and `COALESCE($5::text[], '{}')` for the `tags` array. Confirms the value of actually running the stack (`docker compose up` + `curl`) rather than trusting AI-generated SQL by inspection alone — logged here as the concrete example for the report's "AI mistake and how it was caught" requirement.

---

### Entry 2 — post-M1/M2 review pass — 2026-09-05

**Prompt (exact):**
> Lets proceed to next step, always reviewing each phase we are doing

**Result obtained (summary):**
Ran the `security` and `review-qa` subagents (defined in `.claude/agents/`) against the core CRUD implementation in parallel. Security found no SQL-injection or mass-assignment issues (parameterized queries throughout, explicit column allow-list on update) but flagged the error handler leaking raw Postgres error text (enum/type names) to clients as 500s, plus missing input validation. Review-QA independently reproduced the same two issues live via curl (`priority: "urgent"` → 500 leaking `invalid input value for enum task_priority`; `GET /api/tasks/abc` → 500 leaking a Postgres type error) and additionally flagged the test suite as a placeholder (`assert.ok(true)`) and a missing `catch` in `TaskForm.jsx` around `onCreate`.

**Accepted / Corrected / Rejected:**
Accepted and fixed: added `backend/src/utils/validation.js` (enum/type/date checks + id parsing), wired it into all four mutating controller actions, changed `errorHandler.js` to only pass `err.message` through for errors with an explicit `.status` (operational errors) and return a generic message otherwise, added a `catch` in `TaskForm.jsx` so a failed create surfaces via the existing `error` state instead of an unhandled rejection, replaced the placeholder test file with 14 real tests (unit tests for the new validation module + integration tests for the service layer against live Postgres). Also accepted the cheap Docker suggestions (non-root `USER node`, `.dockerignore` in both `backend/` and `frontend/`). Rejected as out-of-scope for now: locking down CORS and adding auth/rate-limiting — both correctly flagged as only mattering past a local take-home demo, so deferred rather than built.

**Why:**
The two agents corroborated each other (one from static review, one by actually exercising the running API), which made the error-leakage issue high-confidence rather than a stylistic nitpick — worth fixing before writing `RELATORIO.md`. The placeholder-test finding was flagged as literally the exact gap already known in the code's own comment, so no reason to leave it.

**AI mistake or oddity noticed?**
Not a mistake this time, but worth noting: both subagents reviewed the same code independently and reached the same two substantive findings (error leakage, missing validation) from different methods (static reading vs. live curl probing), which was a useful cross-check that neither was hallucinating a problem. After the fix, re-ran the exact curl commands from the review and confirmed all three previously-broken cases now return clean 400s with no Postgres internals exposed, and the full test suite (14/14) passes against the live Dockerized Postgres instance.

---

### Entry 3 — UI polish via Claude Design mockup — 2026-09-05

**Prompt (exact):**
> lets keep going then, and use a mcp for claude design or something we need something polished too

**Result obtained (summary):**
Used Claude Code's built-in `design` skill (not an MCP — clarified that with the user) to draft a static UI mockup as a published Artifact: header, add-task form (title/priority/due date), task list with status checkbox, color-coded priority badges, due dates, tag pills, and a toggleable empty state. Clean/minimal internal-tool aesthetic (warm neutral palette, single indigo accent, Manrope type) chosen since the actual frontend had no pre-existing design system to match. The seeding tool needed Node, which wasn't on the host machine — worked around it by running the exact, unmodified seeding script inside a throwaway `node:20-alpine` Docker container instead (Docker was already core to this project).

**Accepted / Corrected / Rejected:**
Accepted the mockup as the visual reference, then implemented matching CSS/component structure into the real `frontend/src/**` (global stylesheet with CSS custom properties, extended `TaskForm` to include priority + due date fields, extended `TaskList` with a clickable status checkbox wired to the existing `PATCH /api/tasks/:id` endpoint). Did not add a description field or a tags-input control to the create form, even though the mockup showed both — the mockup's sample data included them as illustrations of what the API already supports, not a requirement for the minimal create form; adding UI for them without a real need would have been a half-finished feature.

**Why:**
The user explicitly asked for a design step before implementation rather than styling the app directly, to settle layout/color/typography decisions visually first.

**AI mistake or oddity noticed?**
Mid-task, the user asked to pivot the mockup into a full Trello-style product (multiple boards, drag-and-drop, auth, task assignment, board permissions) plus reiterated the chatbot extension. This would have been a large, undiscussed scope expansion contradicting `CLAUDE.md`'s explicit scope note ("core is non-negotiable... chatbot and roadmap are additive") and the project's own prior scoping decisions. Rather than just building it, stopped and asked whether this was meant for the mockup only, as new real scope, or as an incremental roadmap addition — the user chose the roadmap option, confirming the core submission should stay the simple task list. Logged as a case where pausing to check scope against documented decisions, instead of executing a request literally, was the right call.
