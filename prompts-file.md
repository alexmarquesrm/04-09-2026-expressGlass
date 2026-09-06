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
- DeepSeek API (`deepseek-v4-flash`, via the `openai` SDK pointed at DeepSeek's OpenAI-compatible endpoint) — powers the in-app chatbot extension (tool use / function calling). Built against the Claude API first, tested live against the Gemini API, then switched again to DeepSeek at the user's request — see Entries 9-11.

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

---

### Entry 4 — routing split + visual verification — 2026-09-05

**Prompt (exact):**
> use the mockup from early to improve the UI, and let that be a diferent page from rest thats coming after separate so that i can show it

**Result obtained (summary):**
Added `react-router-dom` and split the frontend into two routes: `/` (the existing Tasks page) and `/assistant` (a clearly-labeled "coming in M4" placeholder for the chatbot extension), with a small pill-style nav bar, so the polished core UI stays demoable on its own without future features landing on the same page. To actually confirm the result rather than trust curl alone, ran a headless Playwright script inside a throwaway `mcr.microsoft.com/playwright` Docker container (no `chromium-cli` or local Node available) attached to the same compose network, screenshotting both routes.

**Accepted / Corrected / Rejected:**
Accepted the routing/nav structure and the visual result after reviewing the screenshots — layout, colors, and typography matched the published mockup closely. Corrected a real bug the screenshot attempt surfaced: the frontend container couldn't be reached by its compose service name (`frontend:5173`) from another container — Vite's dev server has a Host-header allowlist (DNS-rebinding protection) that silently 403'd requests whose `Host` header wasn't `localhost`. Fixed by adding `allowedHosts: ['localhost', 'frontend']` to `vite.config.js`.

**Why:**
The user asked to actually see it, not just be told it was implemented — matches the codebase's own guidance (CLAUDE.md: verify UI changes in a browser before reporting complete, not just via type-checking).

**AI mistake or oddity noticed?**
The `vite.config.js` written back at M0 scaffolding (`host: true`) looked complete at the time but didn't anticipate that anything other than the host machine's browser would ever need to reach the dev server — a reasonable gap for a single-machine take-home app, but it silently broke the first attempt at automated, container-based visual verification with an unhelpful 403 and no clear error message in the response body. Caught only by manually curling the URL with the same Host header Playwright would send, isolating it from the Playwright script itself. Also added the official Playwright MCP (`.mcp.json`) as a follow-up, since it replaces this improvised Docker+Playwright workaround with a supported path for future UI checks.

---

### Entry 5 — update/delete UI, styled confirm dialog, and a stale-HMR bug — 2026-09-05

**Prompt (exact):**
> update or delete task is a must, check every steps missing from the project plan and update if missing

(followed shortly by: "update the confirm delete dialog/alert UI")

**Result obtained (summary):**
Added a full edit UI per task (inline title/priority/due-date/tags form, wired to the existing `PATCH` endpoint) and a delete action, initially behind the browser's native `window.confirm`. The user asked for that native alert to be replaced, so it became a proper styled `ConfirmDialog.jsx` component matching the app's design tokens. Then audited `PROJECT-PLAN.md` in full against the actual repository contents (directory tree, API contract, Docker section, milestone tracker) and corrected several places where it had drifted from reality — including a leftover `.ts`/`.tsx` directory tree from before the project settled on plain JS.

**Accepted / Corrected / Rejected:**
Accepted the new edit/delete UI and the confirm-dialog replacement. Corrected a real bug found while verifying it with a scripted Playwright click-through: the new UI code wasn't showing up in the running app at all — `curl`ing the dev server's own module endpoint proved the served JS was stale even after editing the file on disk. Root cause: Vite's file watcher (chokidar) doesn't reliably receive native filesystem change events across the Windows-host-to-Docker-bind-mount boundary, so it missed the edits. Fixed with `server.watch: { usePolling: true }` in `vite.config.js`, confirmed by seeing real HMR log lines afterward.

**Why:**
The brief marks edit/delete as bonus, but building only the backend for them (already done in M1) without frontend UI would have left "the app" — the thing a reviewer actually clicks around in — missing a feature the user explicitly called a must-have for this build.

**AI mistake or oddity noticed?**
The stale-HMR bug above is the clearest example: the code was correct on disk the whole time, but the running app kept serving an old version, which would have looked like "the AI's new code doesn't work" if not for checking the actual served bytes (`curl .../TaskList.jsx | grep ...`) rather than trusting a browser screenshot alone — the screenshot would have just shown the old UI with no error to explain why. This is the second Vite/Docker networking quirk found this session (`allowedHosts` in Entry 4 was the first) — both were invisible from reading the code and only surfaced by actually exercising the running containers.

---

### Entry 6 — filters + full Portuguese UI pass — 2026-09-05

**Prompt (exact):**
> now add a filter dropdown for priority, marked as done
> after that make the website in portuguese clean up the tasks and add 3 or 4 in portuguese too

**Result obtained (summary):**
Added client-side status/priority filter dropdowns (`TaskFilters.jsx`, filtering the already-fetched task list in memory rather than adding new backend query params — simple and proportionate given the dataset size). Then translated every user-facing string in the frontend to Portuguese: page/nav text, form labels and placeholders, priority badge labels (mapped from the English enum values stored in the DB, which stayed unchanged), empty state, error messages, the confirm dialog, and the Assistant placeholder page — plus `<html lang="pt">` and `pt-PT` date formatting. Deleted the leftover test-data tasks from earlier verification runs and created 4 fresh tasks with Portuguese titles/tags.

**Accepted / Corrected / Rejected:**
Accepted directly — this was a well-scoped, unambiguous request. No corrections needed; verified via a scripted Playwright run that both filters actually narrow the list correctly (1 result for a high-priority filter, 1 for a completed-status filter, matching the seeded data) and that the Assistant page renders in Portuguese too, not just the main task page.

**Why:**
The exercise brief itself is a Portuguese-origin assignment; presenting the demo in Portuguese is a small, low-risk touch that makes the delivery land better for the actual reviewer, and the filters directly improve usability once there's more than a couple of tasks in the list.

**AI mistake or oddity noticed?**
None this round — a clean, verified pass with no surprises, worth noting in the report precisely because not every entry needs to be a caught mistake.

---

### Entry 7 — seed migration + README run instructions — 2026-09-05

**Prompt (exact):**
> add pre-added tasks to the docker run file
> on the readme update the end of the file to show how to run the docker and explain it

**Result obtained (summary):**
Turned the 4 manually-created Portuguese demo tasks into a real migration (`002_seed_demo_tasks.sql`) so any fresh `docker compose up` seeds them automatically, instead of the app starting empty. Verified this properly: deleted the manual duplicates, then did a full `docker compose down -v` + `up` (wiping the Postgres volume entirely) to prove the seed runs correctly on a genuinely clean database, not just on the already-warmed one — confirmed via the API, the frontend still serving, and the full 14-test suite still passing. Added a bilingual "Running it" section to the end of `README.md` explaining what each of the three `docker compose` services does and what happens on first start.

**Accepted / Corrected / Rejected:**
Accepted as-is. The one judgment call was renumbering the *planned* (not yet built) chatbot migrations from `002`/`003` to `003`/`004` in `PROJECT-PLAN.md` to make room for the new seed migration at `002` — a small consistency fix so the plan doc doesn't silently drift from the real migration filenames on disk.

**Why:**
A reviewer's first `docker compose up` showing an empty task list is a worse first impression than one with realistic sample data already in place; testing against a wiped volume (not just a restart) was necessary because a restart alone can't prove the seed logic works from a truly fresh clone, which is the actual scenario that matters.

**AI mistake or oddity noticed?**
None — straightforward, verified end-to-end.

---

### Entry 8 — M4 chatbot extension + security/QA pass — 2026-09-05

**Prompt (exact):**
> next phase

**Result obtained (summary):**
Built M4 end-to-end: `POST /api/chat` (Claude Messages API with tool use across `list_tasks`/`create_task`/`update_task`/`delete_task`, non-destructive tools executing immediately and destructive ones deferred pending confirmation), `POST /api/chat/confirm`, a new `audit_log` table logging every tool call, and a real chat UI on `AssistantPage.jsx` replacing the M2 placeholder. Then ran the established Security + Review-QA subagent pass on the new code before considering it done.

**Accepted / Corrected / Rejected:**
Both agents' findings were accepted and fixed, not just noted:
- Security flagged that the confirm endpoint identified a pending action by its raw sequential `audit_log.id` — guessable/enumerable, letting anyone iterate small integers to confirm or cancel someone else's pending destructive action. Fixed by switching to a random `confirmation_token` (`crypto.randomUUID()`) returned to the client instead of the row id, with the DB lookup keyed on the token.
- Security also flagged that the destructive-action confirmation prompt didn't disclose *what* was actually changing (just "update task #7?"). Fixed by generating a field-by-field diff (old value → new value) in the confirmation reply.
- Security flagged that Claude's raw tool-call `input` bypassed the same `validateTaskFields`/`parseId` checks the REST API enforces, so a malformed id or field would surface as a raw Postgres error. Fixed by running tool args through the existing validation helpers before touching the DB.
- Review-QA found a genuine correctness bug (rated critical): `POST /api/chat/confirm` always replied "task deleted/updated successfully" even when the target task no longer existed — reproduced live by confirming a delete for a nonexistent id and getting a false-positive success message. Fixed to check the tool's actual result and reply honestly when nothing happened.
- Review-QA also flagged that the new `audit.service.test.js` never cleaned up the rows it created, unlike the existing `tasks.test.js` convention. Fixed by tracking and deleting created rows in `test.after`.
- Minor fixes taken from both reports without much debate: wrapped Claude API errors so a raw Anthropic SDK error message never reaches the client (generic 502 instead), and stopped `errorHandler` from `console.error`-logging routine 4xx responses.
- Not fixed, deliberately: no rate limiting on `/api/chat` — accepted as a known, documented risk given the whole app has no auth to begin with, and adding real rate limiting felt out of proportion for a take-home.

**Why:**
This project's own working agreement (see `PROJECT-PLAN.md` section 6/8 and this session's practice) is to run Security/Review-QA after every milestone before moving on, specifically so an agent's own code doesn't get to grade its own homework. Both passes earned their keep here — the sequential-id and false-success-reply issues in particular were not things a purely-functional "does it run" check would have caught, since both looked correct in the happy path and only broke under adversarial or edge-case input.

**AI mistake or oddity noticed?**
Yes, two real ones, both caught by the subagent review rather than by initial self-testing: (1) the confirm endpoint's false "success" reply on a no-op delete/update (a correctness bug, not just a style nit), and (2) using the audit log's own auto-increment primary key as a bearer token for a destructive-action confirmation, which is a classic "don't use a sequential id as a capability token" mistake worth remembering for any future confirm/approve-style endpoint.

---

### Entry 9 — swapping the chatbot from Claude to Gemini — 2026-09-05

**Prompt (exact):**
> i added a gemini key to test no anthopic

**Result obtained (summary):**
The user had pasted a Gemini API key into the `ANTHROPIC_API_KEY` env var to "test" the chatbot without an Anthropic key. Since that key format/API is entirely different from what `llm.service.js` was written against, it would just fail auth — not actually test anything. Explained the mismatch, then asked (via a scoped multiple-choice question, since this is a real architecture decision, not a config tweak) whether to get a real Anthropic key instead, fully switch the backend to Gemini, or support both. The user chose to switch fully to Gemini. Rewrote `llm.service.js` to use `@google/genai` instead of `@anthropic-ai/sdk`, renamed the env var to `GEMINI_API_KEY` everywhere (`.env`, `.env.example`, `docker-compose.yml`, `CLAUDE.md`, `README.md`), and validated the whole thing against the real live API using the user's actual key (not mocked) — the same "run it for real, don't just read the code" approach that caught the original Postgres enum-cast bug in M1.

**Accepted / Corrected / Rejected:**
Accepted, but only after fixing two things the live API itself surfaced that no amount of code review would have caught:
1. The first live call 404'd: `gemini-2.5-flash` (my initial guess at a model id) came back with an explicit API error naming the correct current model, `gemini-3.6-flash`. Corrected immediately from the error message.
2. A live test of "apaga a tarefa 9" showed Gemini sometimes calls `list_tasks` to double-check a task before proposing the actual `delete_task`/`update_task` call — meaning one user message can legitimately need two tool calls in a row. The original single-tool-call design (copied from the Claude version, which never needed this) silently swallowed the destructive call: the reply text asked "are you sure?" but `requires_confirmation` was empty, so the frontend showed no way to actually confirm. Fixed with a small bounded loop (`MAX_TOOL_HOPS = 4`) instead of a strict single call. Separately, in some phrasings Gemini asked "are you sure?" in plain text without calling the destructive tool at all — fixed by explicitly telling it in the system prompt to always call the tool immediately and never self-confirm in text, since the app already has its own confirmation step after the tool call.

**Why:**
The user's instinct to test with a real key was the right one — this is exactly the kind of bug (wrong model string, provider-specific tool-calling quirks) that only shows up when you actually run the real API, matching the enum-cast lesson from M1. Rather than guessing at the Gemini function-calling response shape from memory, I wrote small throwaway probe scripts (`_probe.cjs`/`_probe2.cjs`, deleted after use) to inspect the real API's raw response before touching `llm.service.js`, which is how the exact shape of `response.functionCalls`, `response.text`, and the function-response turn format were confirmed.

**AI mistake or oddity noticed?**
Yes, twofold, both from carrying over an unexamined assumption from the Claude implementation: assuming (a) a hardcoded model id would still be valid months later without checking, and (b) that "the model always emits a tool call for destructive actions in the same turn" would hold for every provider — Gemini's actual behavior (sometimes chaining a lookup first, sometimes asking for confirmation in text instead of calling the tool) broke that assumption in ways the Claude-only implementation had never been tested against. Both were real, live-reproducible bugs, not just theoretical edge cases.

---

### Entry 10 — generic 502 was hiding a real 429 quota error — 2026-09-05/06

**Prompt (exact):**
> Nao foi possivel falar com o assistente de momento. Tenta novamente.

**Result obtained (summary):**
The user pasted back the chatbot's own generic error message after trying it live in the browser. That message was the deliberately-generic wrapper `callGemini()` throws on *any* failed Gemini call (added during the Security-review fix pass in Entry 8, specifically to stop a raw upstream error reaching the client). The problem: that same catch block only logged the *wrapped* generic error, never the original one — so my own security fix had accidentally made the real cause invisible in the server logs too, not just to the client. Added a `console.error` of the original error before wrapping it, reproduced the failure, and found the actual cause: `429 RESOURCE_EXHAUSTED` — the Gemini free-tier key is capped at 20 requests/day for `gemini-3.6-flash`, a quota this build's own live testing (Entries 9 and this session's manual curl/Playwright checks) had already burned through. Fixed by special-casing 429 in `callGemini()` into its own honest Portuguese message ("hit today's free quota, try again later") instead of lumping it in with the generic "something went wrong, try again" message, which was actively misleading for a daily quota (retrying immediately can't help).

**Accepted / Corrected / Rejected:**
Accepted, with the logging gap treated as its own bug worth fixing, not just the user-facing message.

**Why:**
A sanitize-the-error-message fix that also erases the error from the server's own logs is a net loss for debuggability, even though the original intent (don't leak upstream SDK error text to an untrusted client) was correct. The fix should have kept full detail server-side from the start; catching this quickly only worked because the user pasted the exact message back rather than just saying "the chatbot is broken."

**AI mistake or oddity noticed?**
Yes — a self-inflicted one. The Security-review fix in Entry 8 (wrap Gemini/Anthropic errors so raw SDK text never reaches the client) was implemented in a way that also discarded the original error before it ever reached a log line, which is a distinct mistake from the thing the fix was meant to address. General lesson for next time: sanitizing an error for the *client* response should never mean losing it for *server-side* logging — log the real error, then throw the sanitized one.

---

### Entry 11 — switching again, Gemini to DeepSeek, under an explicit API-cost budget — 2026-09-06

**Prompt (exact):**
> changing to deepseek API afterall, use one request to test da API, dont waste money

(followed shortly after by: "deepseek-v4-flash is enough", specifying the model)

**Result obtained (summary):**
A second provider switch, this time under an explicit constraint that changed how verification had to work: only one real, billed API call was allowed. Rewrote `llm.service.js` a third time, now against DeepSeek's OpenAI-compatible chat-completions endpoint using the official `openai` npm package (`baseURL: 'https://api.deepseek.com'`, model `deepseek-v4-flash` per the user's follow-up), replacing `@google/genai`. Renamed the env var again (`GEMINI_API_KEY` -> `DEEPSEEK_API_KEY`) across `.env`/`.env.example`/`docker-compose.yml`/`CLAUDE.md`/`README.md`. Ran everything that costs nothing first — the full 21-test suite (pure Node/Postgres, no LLM calls) — before touching the real API at all. Spent the single allowed call on a short throwaway probe script (`_probe_ds.cjs`, deleted after) hitting the real endpoint once with a destructive-intent message, dumped the full raw response, and confirmed the response shape matched the standard OpenAI format exactly (`choices[0].message.tool_calls[0].function.{name,arguments}`) — so the rest of the already-written code could be trusted by inspection rather than by further live calls. Also re-verified the confirm/cancel path (which never calls the LLM at all, so it's free) by manually seeding a pending `audit_log` row and confirming it through the real HTTP endpoint.

**Accepted / Corrected / Rejected:**
Accepted. One real correction along the way: the first attempt at the single test call failed before any network request even went out (`OPENAI_API_KEY environment variable is missing`) — not an API problem, but a `docker compose restart` not being enough to pick up the renamed env var (only `docker compose up -d`/recreate re-reads `docker-compose.yml`'s environment block; `restart` just restarts the existing container with its old environment). Fixed by recreating the container properly before retrying, so the wasted attempt cost nothing (it never reached DeepSeek's servers).

**Why:**
Real money changes the right verification strategy: with Gemini's free tier the approach was "run it for real, repeatedly, until it's solid," which is how the multi-hop tool-calling bug got caught — but that same approach isn't appropriate once each call has a real cost the user is paying directly. The right adaptation was to front-load everything free (the non-API test suite, code review, the free confirm-path check) and spend the one paid call on the single highest-uncertainty question (does the exact request/response shape match what the code assumes), rather than on re-proving things already established to be provider-agnostic (like the confirm/cancel logic) or already known from the Gemini pass (like the multi-hop tool-calling behavior, which reappeared identically with DeepSeek and confirmed the existing bounded-loop fix was the right generalization, not a Gemini-specific patch).

**AI mistake or oddity noticed?**
One small one, caught before it could cost anything: assuming a `docker compose restart` would be enough after renaming an env var in `docker-compose.yml`, when only recreating the container actually re-reads that file's environment block. Caught because the OpenAI client fails loudly and immediately when no key is present, before making any network call — a case where fast, obvious local failure is exactly the safety net an expensive-to-repeat live test needs.

---

### Entry 12 — a false hallucination alarm, and a real bug hiding under it — 2026-09-06

**Prompt (exact):**
> assistent output but i dont see the note "confirmar envio email" on the task list why?

(the user had pasted a chat transcript where the assistant listed a task, "Reunião com o Francisco," with a note about emailing a confirmation, that didn't match any of the known seeded demo tasks)

**Result obtained (summary):**
Misdiagnosed this on first read: since "Reunião com o Francisco" matched none of the 4 known seeded tasks, I concluded the assistant had fabricated an entire task and presented it as real — a serious grounding failure for a tool whose whole premise is trustworthy function-calling — and proposed two fixes (a free prompt tweak vs. a guaranteed-but-2x-cost `tool_choice: required` change) before doing anything. The user corrected this immediately: they had created that exact task themselves, live, through the chatbot, in an earlier message not visible to me, and asked a more specific and more useful question instead — is there a database field for the extra note they'd included? Checked the real row via `curl` and found the task was completely real (`id: 8`) and the note was already sitting in the `description` column, exactly as the chatbot had written it. The actual bug: `description` has existed on the `tasks` table and round-tripped through the API since M1, but the frontend — `TaskForm.jsx`, `TaskList.jsx`, and the inline edit row — never had a field for it, in any of the M2/M3/M4 passes. It was a correct, silently-unused column the whole time; nothing surfaced it until the chatbot was the first thing to ever actually populate it with real content. Fixed by adding a description line under the title in `TaskList.jsx`, an optional "Notas" input to `TaskForm.jsx`, and the same field to the inline edit row — a small, frontend-only, zero-API-cost fix, verified visually via Playwright against the real task.

**Accepted / Corrected / Rejected:**
My initial hallucination diagnosis was rejected by the user (correctly) before any fix was applied — no harm done, since I asked before acting rather than jumping straight to rewriting the system prompt or the tool-calling logic for a bug that didn't exist. The actual fix (surfacing `description` in the UI) was accepted as-is.

**Why:**
Worth keeping in the report as a paired lesson: (1) a plausible-sounding "the AI made this up" diagnosis needs to be checked against the real database before acting on it, not just against a mental list of "tasks I remember seeding" — I don't have visibility into everything the user does in their own browser session; and (2) this is a good example of a bug that pre-dated the chatbot entirely (a full milestone's worth of frontend work never wired up an existing, working DB/API field) but was only ever going to be *discovered* once something started actually writing meaningful data into it — the chatbot didn't cause the bug, it just was the first thing to exercise the code path that revealed it.

**AI mistake or oddity noticed?**
Yes, mine: jumping to "the LLM hallucinated" as the explanation for unexpected chat output, without first checking the one cheap, decisive, non-LLM source of truth available (the actual Postgres row) before proposing a fix. The lesson generalizes past this one bug: when a chatbot's output looks wrong, check the ground truth (the database, the logs) before assuming the model is the thing that's wrong — the discrepancy might instead be a real feature gap the chatbot exposed rather than caused.

---

### Entry 13 — M5's last item, NL due dates, and an off-by-one-day landmine — 2026-09-06

**Prompt (exact):**
> lets go for the next phase

**Result obtained (summary):**
Checked `PROJECT-PLAN.md`'s build order and found M5 already mostly done (tags/priority from M2, confirmation-before-destructive-action and the audit trail from M4) — the one item left was "NL due dates." The chatbot had already been resolving relative dates like "amanhã" correctly in earlier live testing (Entry 12's task got `due_date: 2026-09-06` from "amanhã"), but purely by the model's own unstated assumption about what day "today" is — the system prompt never told it. Fixed properly: `SYSTEM_PROMPT` became `buildSystemPrompt()`, computing the real current date fresh on every request and stating it explicitly ("A data de hoje e {date} ({weekday})"), so relative-date resolution has a correct, explicit anchor instead of an implicit guess. While implementing this, caught a second, more serious latent bug before it ever shipped: the naive way to get "today" (`new Date().toISOString().slice(0,10)`) is always UTC, so it would silently compute the *wrong calendar day* every evening/night in any timezone ahead of UTC (confirmed live: at 23:32 UTC the container said "2026-09-05" while the user's own local clock — per this session's own date context — had already rolled over to "2026-09-06"). Fixed by reading the `Date` object's local year/month/day instead of its UTC ISO string, and by setting `TZ=Europe/Lisbon` on the backend container (plus installing `tzdata` in `backend/Dockerfile`, since Alpine's Node image has none by default and would otherwise silently ignore `TZ` and stay on UTC) — verified by printing the container's local date/weekday and confirming it matched the real one.

**Accepted / Corrected / Rejected:**
Accepted. Deliberately scoped down from a broader reading of "NL due dates": did not add natural-language parsing to the manual create/edit form's `<input type="date">` field, since that's a native, unambiguous date picker already — swapping it for free-text NL parsing would trade a working, precise control for a fuzzier one with real ambiguity risk, for no clear benefit outside the chat interface where NL dates actually belong. Also did not spend a live DeepSeek call to re-verify the chatbot's relative-date behavior with the new grounding in place, keeping with the "don't spend API calls without asking" rule from Entry 11 — the fix was verified as far as it can be for free (the computed date/weekday is provably correct now), just not re-proven against a live model response.

**Why:**
"The model happened to get it right once" is not the same as "the feature works" — Entry 12's correct date was luck, not grounding, and the very next day (literally, given the UTC/local mismatch found here) it could have been wrong in a way nobody would notice until a task showed up with the wrong due date. Timezone bugs are a classic case of "invisible until the exact wrong moment" — this one would only ever have manifested for a few hours a day, which is exactly the kind of bug that's worth catching by reasoning about UTC-vs-local explicitly rather than by hoping live testing happens to run during the affected window.

**AI mistake or oddity noticed?**
A near-miss rather than a shipped mistake: almost used `toISOString()` for "today" without noticing it's UTC-based, which is a common enough JavaScript date pitfall that it was worth pausing on deliberately rather than trusting the first version that ran without erroring — this bug doesn't throw, it just silently computes a plausible-looking wrong answer some of the time, which is worse than a crash for something feeding into an LLM's date arithmetic.

---

### Entry 14 — M6 holistic review catches a live regression the per-feature passes missed — 2026-09-06

**Prompt (exact):**
> lets check M6 then
> what does M stand for?

**Result obtained (summary):**
Started the final milestone (M6 - Polish): a README pass, `RELATORIO.md` expansion, and - the important part - a Security + Review-QA subagent pass over the *whole* app together, explicitly asked to look holistically rather than per-feature the way every prior review this project had been. That framing paid off immediately: Review-QA found a critical, currently-live bug that none of the individual M4/M5 reviews had caught - every `due_date` in the entire app (plain REST API, frontend display, chatbot replies) was coming back one calendar day early, live, in production right now, because Portugal is in DST. Root cause: M5's own fix (setting `TZ=Europe/Lisbon` so the chatbot's "what day is today" grounding would be correct) had a side effect nobody checked - `pg` builds a JS `Date` object from a `DATE` column at local midnight, and Express's `res.json()` then serializes that via `.toISOString()` (always UTC), so any non-zero local offset silently shifts the date back a day. It only "looked fine" outside the DST window, which is exactly why the M5 review - which verified the *computation* of today's date was correct, but explicitly didn't re-verify the chatbot's live output to conserve API spend - never saw it. Security's holistic pass separately caught that `cors()` was configured with no options at all (allow-any-origin) with no auth anywhere and no rate limit on the paid `/api/chat` endpoint - individually each of those was a known, accepted risk, but nobody had looked at the three of them stacked together before. Fixed both: `backend/src/db/pool.js` now overrides `pg`'s type parser for `DATE` columns to return the raw string instead of ever building a `Date` object (the actual root fix, not reverting `TZ`, which is still needed), with two new regression tests that assert the fix directly rather than depending on which season the test suite happens to run in; CORS now restricted to the real frontend origin.

**Accepted / Corrected / Rejected:**
Both findings accepted and fixed. A handful of smaller Security findings (task content flowing back into the chatbot's own context as a theoretical prompt-injection surface, loose `due_date` input validation, a benign double-confirm race) were accepted as documented, proportionate risk for a no-auth take-home rather than fixed, matching how every prior review pass in this project weighed severity against project scope.

**Why:**
This is the clearest demonstration in the whole project of why a review pass scoped to "the feature I just built" isn't the same as a review pass scoped to "the whole system as it now stands" - the due_date bug was invisible to M5's own review because M5's review was, reasonably, scoped to M5's own change in isolation (and further limited by an explicit API-cost budget). Only once asked to look across the entire app at once, cold, without the context of "I just wrote this and it looked right," did the interaction between two independently-reasonable decisions (add `TZ` for the chatbot; let `pg`/Express handle date serialization by default) surface as a real bug. The general lesson: a final, holistic review pass earns its place in the schedule even when every individual milestone was already reviewed - some bugs only exist in the gaps between features, not inside any one of them.

**AI mistake or oddity noticed?**
Yes, and it's the same root mistake as Entry 13's near-miss, except this time it actually shipped: trusting that a fix verified against one narrow criterion ("is the computed date correct") was sufficient, without tracing every other place a change like `TZ=Europe/Lisbon` could reach. `TZ` is a genuinely global, cross-cutting setting - changing it can't be scoped to "just the chatbot's date logic" no matter how the code that reads it is scoped, and that should have been the first question asked when M5's fix was made, not something a later, separate review pass had to discover.

---

### Entry 15 — S1, multiple boards, the first stretch-tier item — 2026-09-06

**Prompt (exact):**
> the end of the file there the stretch tier, dont change whats dones, just create the stretch tier on new routes
> All 5, in the plan's own order (Recommended)

**Result obtained (summary):**
Built S1 (multiple boards) as entirely new, additive files: migrations 004/005 (`boards`, `board_tasks` - the latter reusing the `task_status`/`task_priority` enums from 001 rather than duplicating them), `boards.service/controller/routes.js` and `boardTasks.service/controller.js`, a `validateBoardFields` export, and `/boards` + `/boards/:id` frontend pages with a two-column Pendente/Concluída view. The only touches to existing files were the minimum needed to make the feature reachable: one route-mount line in `server.js`, one nav link, and two new routes plus a conditional layout width in `App.jsx`. Verified with Playwright that the existing Tasks/Assistant pages render identically to before. Ran Security + Review-QA in parallel, same as every M0-M6 milestone. Both flagged the same two things independently: `position` (added for the not-yet-built S2) had zero validation - a live `PATCH` with a non-numeric value returned a raw 500 instead of a 400 - and the boards UI skipped the app's own established `ConfirmDialog` pattern for destructive actions, deleting a board (which cascades to every task on it) on a single click. Fixed both, plus two smaller QA-caught bugs (a stale error banner that never cleared on success, and a board-detail page stuck permanently on "A carregar..." if the board 404s) and two cheap suggestions (a `parseId` error message that said "task" even for a board id, and an `updateBoard` that bumped `updated_at` on a no-op PATCH).

**Accepted / Corrected / Rejected:**
All Warning-level findings from both reviews fixed. One Suggestion-level finding left as documented risk: board deletion's `ON DELETE CASCADE` has no audit-log entry, unlike single-task deletion's audit trail - explicitly deferred until S3 adds real ownership, since ownership is what should actually gate who can delete a board, not an audit log bolted onto an unauthenticated endpoint.

**Why:**
The user's instruction was unusually explicit about blast radius ("dont change whats dones, just create ... on new routes"), so the build was scoped file-by-file against that constraint rather than just "seems reasonable" - reusing existing enums instead of new ones, and treating every touch to a shared file as something to justify individually rather than default to editing freely.

**AI mistake or oddity noticed?**
Not a code mistake, but a verification one: my first attempt to Playwright-test the new pages against the frontend inside a throwaway Docker container failed because the browser (running inside the container's network) couldn't resolve `localhost:3001` to the real backend service, and a second attempt hit the CORS lock-down from M6 (the test browser's origin was the container's own hostname, not the real frontend origin M6 had restricted CORS to). Both were test-harness problems, not app bugs - solved by joining the test container to the compose network and routing/rewriting requests to the real service names, confirming CORS was still doing its job correctly along the way.

---

### Entry 16 — S2, drag-and-drop, and an off-by-one I caught before either review did — 2026-09-06

**Prompt (exact):**
> where are the rest of the features? logins, multiples users, assign users to tasks, board etc
> (AskUserQuestion) "Keep original order (Recommended)" / "After stretch tier"

**Result obtained (summary):**
Built S2 (drag-and-drop) as a frontend-only change on top of S1's existing `position` column - no backend files touched. Used native HTML5 drag-and-drop (no new dependency): dropping a card reorders it within a column or moves it to the other column, recomputing `position` as `index * 10` for every task in the affected column(s) and persisting one `PATCH` per changed task. While writing my own Playwright verification script (dragging a card onto another to test reordering), the result came back wrong - `[A,B,C]` dragging A onto C produced `[B,C,A]` instead of the expected `[B,A,C]`. Traced it to an off-by-one: the drop target's index was computed against the full column list *including* the dragged card, but the destination list used to compute new positions had already excluded it, so inserting "before index 2" landed after the (now shorter) list's actual end. Fixed by adjusting the target index down by one whenever the dragged card's original position in that same column was before the target. Re-ran the same reorder, cross-column move, and reload-persistence checks - all correct afterward. Security and Review-QA (run in parallel, same discipline as S1) both independently flagged the same real fragility from a different angle: a failed `PATCH` mid-batch reverted the *entire* local task list to its pre-drag snapshot, discarding any already-successful writes' effects from the UI's perspective and leaving it out of sync with the actual DB until a reload.

**Accepted / Corrected / Rejected:**
Fixed the mid-batch-failure case (now re-fetches from the server on failure instead of blindly reverting to a stale snapshot) and a related stale-closure risk Review-QA flagged (rapid successive drags could read pre-first-drag state; switched to a ref instead of render-scoped state). Also fixed two Suggestion-level items: redundant `PATCH` calls firing even for a true no-op drag, and newly created board tasks always getting `position: 0` regardless of how many tasks were already in that column (now computed from the column's current max). Applied Security's suggested upper bound on `position` (matching Postgres's `INTEGER` column) even though it wasn't exploitable, since it was a one-line fix for a real (if minor) gap.

**Why:**
The off-by-one is a good example of why "verify by tracing the algorithm on paper" isn't a substitute for "verify by running it": the bug was in exactly the kind of index-arithmetic edge case that's easy to convince yourself is correct while writing it, and only showed up because the Playwright script asserted the *actual resulting order*, not just "did the request succeed."

**AI mistake or oddity noticed?**
Yes - the off-by-one itself. I wrote the insert-before-target logic and initially reasoned it was correct without tracing a concrete example by hand; the bug only surfaced because I insisted on checking the live DOM order after a real drag-and-drop, rather than trusting that "no errors were thrown" meant the feature worked. Caught and fixed before either subagent review ran, which meant both reviews were checking already-correct reordering logic and could focus on the failure-recovery gap instead.

---

### Entry 17 — S3, accounts and JWT auth, and a race condition my own regression test had to force to prove — 2026-09-06

**Prompt (exact):**
> start the next steps

**Result obtained (summary):**
Built S3 (user accounts/auth): a `users` table, JWT-in-httpOnly-cookie auth (`jsonwebtoken` + `bcryptjs` - chosen over a session store specifically to avoid adding Redis for a take-home), `/api/auth/register|login|logout|me`, and a `requireAuth` middleware left unused by any existing route on purpose (S5's job to actually gate boards with it). Verified the whole flow myself first - register, session-persists-across-reload, logout, wrong-password, duplicate-email - before either review ran, including a real gotcha in my own test harness: testing session persistence through a headless browser inside a throwaway Docker container failed at first, because the container reached the frontend and backend via two *different* Docker-network hostnames (`frontend`, `backend`), and browsers only treat requests as "same-site" (which `SameSite=Lax` cookies need to survive a cross-origin fetch) when they share a registrable domain - two arbitrary hostnames don't. Fixed the test itself by routing both through the same hostname (`host.docker.internal`, temporarily added to Vite's dev-server allowlist and reverted right after), which reproduces the real deployment's actual same-site relationship (`localhost:5173` and `localhost:3001` share `localhost`, so this was purely a test-harness gap, not an app bug). Security's review called the core mechanics solid (real JWT verification, not just decoding; parameterized queries; correct cookie flags; no secret leakage) and flagged two proportionate, accepted risks: a login timing side-channel (skipping bcrypt entirely for a nonexistent email measurably speeds up that response vs. a wrong-password one) and no rate-limiting on the auth endpoints. Review-QA found a real Critical: forcing two concurrent `createUser` calls for the same brand-new email (bypassing normal HTTP timing) reliably produced an unhandled Postgres unique-violation - a raw 500 instead of the clean 409 the sequential path already returns, because the app's own pre-check-then-insert had a real TOCTOU gap the pre-check couldn't close by itself.

**Accepted / Corrected / Rejected:**
Fixed the race (catch the DB's `23505` in `authService.createUser` itself and translate it to the same 409 message, rather than trusting the pre-check alone), plus two smaller findings - `secure: false` on the auth cookie was hardcoded instead of gated on `NODE_ENV`, and `logout`'s `clearCookie` call had its own separately-typed options object instead of deriving from the same constant used to set the cookie. Security's two warnings (timing side-channel, no rate-limiting) accepted as documented, proportionate risk for a take-home, matching how every prior review in this project has weighed severity against project scope - noted explicitly rather than silently dropped.

**Why:**
The race condition is the clearest example yet in this project of "verify by actually forcing the failure, not by reading the code and reasoning it looks fine": QA's own initial attempt to reproduce it over real HTTP requests mostly didn't reproduce it (normal request/response timing happened to serialize the check-then-insert often enough to mask the gap), and only calling the service function directly, twice, with no timing gap between them, reliably exposed it. A bug that "usually doesn't happen" under normal load is still a bug - it just needs a test that removes the luck.

**AI mistake or oddity noticed?**
Not exactly a mistake, but a near-miss worth recording: my own first-draft register logic (check-then-insert) is a textbook TOCTOU pattern, and I wrote it without immediately adding the DB-constraint-violation catch that should always accompany a uniqueness pre-check backed by a real DB constraint. The pre-check alone reads as "obviously correct" in isolation - it only fails under a timing window most manual testing will never hit, which is exactly why QA's job was to force it rather than just exercise the happy path.

---

### Entry 18 — S4, task assignment, and a test suite that was quietly littering its own database — 2026-09-06

**Prompt (exact):**
> next tasks

**Result obtained (summary):**
Built S4 (task assignment): `assignee_id` added to `board_tasks` (not the original core `tasks` table - assignment is a boards-era concept, and the core deliverable stays untouched), a new unauthenticated `GET /api/users` endpoint to populate an assignment dropdown, and `boardTasks.service.js` rewritten to LEFT JOIN `users` so responses carry both `assignee_id` and a display-ready `assignee_name`. While writing tests for this, noticed `backend/tests/auth.test.js` (from S3) had never once cleaned up the users it created across its six tests - every single test run permanently added rows to the dev database, and a live check turned up 14+ accumulated junk users (`Ana`, `Bea`, `Cat`... from repeated runs) sitting in a database meant to demo a small task app. Fixed it with the same `test.after` cleanup pattern `boards.test.js` already used, and purged the accumulated rows. Security and Review-QA (run in parallel, same as every prior slice) both independently flagged the same real issue from different angles: Security called out that `GET /api/users` hands out every registered user's *email address* to anyone, no login required - a meaningfully bigger disclosure than the app's existing "boards/tasks are open" gap, since email is specifically PII and the app already has a `requireAuth` middleware sitting unused. Review-QA separately caught a latent correctness bug: the new FK-violation handler in `boardTasks.service.js` blamed *any* Postgres foreign-key error on `assignee_id`, even though `board_tasks` has two FK columns (`board_id` and `assignee_id`) - not exploitable today (the controller's board-existence check runs first), but a real trap waiting for the next person who touches this code path without knowing that invariant holds.

**Accepted / Corrected / Rejected:**
Fixed both: dropped `email` from `GET /api/users`'s response (the assignment dropdown only ever needed `id`+`name`), and added an `err.constraint` check to `throwIfInvalidAssignee` so it only claims to be an assignee problem when the violated constraint's name actually says so. Also added a small dedicated test file for `users.service.js`, which had zero direct coverage until now.

**Why:**
The test-pollution bug is worth dwelling on because it's a different *category* of mistake than anything caught in S1-S3's reviews: those were all about the application being wrong under some input; this was about my own verification process being wrong in a way that wouldn't show up as a failing test - the tests all passed every time, they just also silently corrupted the environment they ran in. "The tests are green" and "the tests are clean" turned out to be two different claims, and only the second one is what actually keeps a shared dev database trustworthy over many sessions.

**AI mistake or oddity noticed?**
Yes - I wrote `auth.test.js` in the S3 session without giving its cleanup the same scrutiny `boards.test.js` already modeled two sessions earlier in the same file structure. The convention existed, right next to where I was working, and I didn't apply it - not because it was hard, but because focus during S3 was entirely on the auth logic under test, and "does this test file also delete what it made" wasn't part of the review checklist I was running against myself at the time. It took building a *second* feature that happened to also create users (S4's assignment tests) and noticing how many rows had piled up to surface it.

---

### Entry 19 — S5, board permissions, the last stretch-tier item, and a bug my own tests couldn't have caught — 2026-09-06

**Prompt (exact):**
> next task

**Result obtained (summary):**
Built S5 (board-level permissions), the final and most consequential stretch-tier slice - the first one that actually gates anything behind login, on top of S1-S4. New `board_members` table (owner/member roles), a transaction so a board can never exist without an owner, and `requireBoardMember`/`requireBoardOwner` middleware gating every board and task route. Verified the whole cross-user flow myself first with two real accounts (owner creates a board, a stranger gets 403 not 404, adding them as a member grants access, removing it revokes access immediately, a member can't edit the board or manage members) before either review ran. Security, reviewing this specifically as the authorization-critical slice, found the core model sound and flagged two real gaps: a TOCTOU race on the "only owner can't be removed" check, and `assignee_id` (from S4) never checking that the assignee is actually *on* the board being assigned to, now that a table exists specifically to answer that. Review-QA found something Security's angle couldn't have: `POST /api/boards/:id/members` - the endpoint for adding a member or changing someone's role - had *no* last-owner guard at all (only the DELETE endpoint did), so a board's sole owner could demote themselves to `member` in one single, everyday API call - no race, no bad intent, just the wrong dropdown selection - and permanently lock everyone out of the board with no way back in through the API. QA's diagnosis of *why* it shipped was the most useful part of the finding: every one of the 62 passing tests at that point was a service-level unit test; nothing exercised the actual HTTP routes or the middleware chain, which is exactly where this bug lived.

**Accepted / Corrected / Rejected:**
Fixed all three. Added the missing last-owner guard to the add/role-change endpoint, then went further than a matching patch and properly closed the underlying race Security flagged by wrapping both the add and remove paths in a transaction that row-locks a board's membership rows before checking the owner count - a partial fix that only patched QA's exact repro would have left Security's race intact. Added a check that an assignee must actually be a board member, which meant updating several S4 tests that had been assigning tasks to users who were never added to the board (that was only ever a valid assignment because the old code never checked). Directly addressed QA's root-cause diagnosis rather than just the symptom: added `supertest` and a new test file that sends real HTTP requests through the actual Express app, covering the exact permission boundaries this slice is supposed to enforce, including a regression test that reproduces the precise bug QA found. That required a small, standard change to `server.js` (guarding `app.listen()` behind `require.main === module`) so the app could be required by tests without trying to bind the port a second time.

**Why:**
QA's framing is worth keeping: "62/62 passing" was never a meaningful signal for this slice, because the tests and the bug lived in different layers of the same codebase - unit tests exercised `boardMembersService.addMember` directly (which has always worked correctly), while the bug was in the controller logic sitting *between* the route and that service, a layer only an HTTP-level test can see. A green test suite only proves what it actually exercises, and "we have lots of tests" is not the same claim as "we have tests of the thing that's actually new here."

**AI mistake or oddity noticed?**
Yes, and it's a direct repeat of the shape of Entry 18's lesson, one level up: just as `auth.test.js` copied S3's login logic without copying `boards.test.js`'s cleanup discipline, `boardMembers.controller.js`'s `create()` function was written without copying the last-owner guard that `destroy()` right next to it already had - the exact same invariant ("don't let this board end up with zero owners"), enforced on one write path and silently forgotten on the other, in the same file, in the same session. The recurring pattern across both entries: a safety property that exists in one place doesn't automatically apply everywhere it should just because I was aware of it once - each new code path that touches the same invariant needs it re-asserted, not assumed.

**Stretch tier complete.** S1 (boards) through S5 (permissions) are all built, reviewed, and fixed - the full Trello-style direction raised in section 10 of `PROJECT-PLAN.md` is now done.

---

### Entry 20 — default data seed + a Trello-style visual pass on the boards UI — 2026-09-06

**Prompt (exact):**
> seed the whole database, and default users too
>
> after all this lets improve the design something more like the prints, something more polished

**Result obtained (summary):**
Two pieces of work. First, a new migration `009_seed_default_data.sql` adding 4 default users, 3 boards, and mixed owner/member `board_members` rows plus a handful of assigned `board_tasks` - so a fresh `docker compose up` has real accounts and real board data to click through, not just the 4 sample core tasks M0 already seeded. All 4 users share a bcrypt hash for `password123`, generated once via the app's own `bcryptjs` in the running backend container and pasted into the SQL as a literal. Applying it against the live dev DB failed twice before it ran clean: Postgres doesn't auto-coerce a bare string/date/array literal to an enum/`date`/`text[]` column type when it arrives via `UNION ALL` feeding an `INSERT ... SELECT`, the way it would for a plain `INSERT ... VALUES` - fixed with explicit `::board_role`/`::task_status`/`::task_priority`/`::date`/`::text[]` casts on every branch. Second, a visual polish pass on `/boards` and the board detail page to match the Trello screenshots the user shared as the target look: a grid of gradient-banner board tiles (color hashed from the board id) replacing the old flat list, a dashed "+ Criar quadro" create-tile, a colored hero banner on the board page, a new `Avatar` component (colored initials) for members/assignees, and a brand mark in the nav bar and auth pages.

**Accepted / Corrected / Rejected:**
Both pieces accepted as built. Two follow-up fixes came out of Playwright-driven visual QA (screenshots of the actual running app after each change, not just checking it compiled): the 8-color gradient palette had two entries that both read as purple, swapped one to cyan for real visual separation; and the pencil/trash icon buttons on task rows only showed a background on hover, which read as an unstyled afterthought next to the new board-tile delete button's always-visible white chip - fixed by giving the shared `.icon-btn` class a permanent bordered-chip look at rest, matching the 1px-border language already used on fields and badges elsewhere in the app. A second QA round confirmed both fixes read correctly in context before calling it done.

**Why:**
The migration-casting issue is a small but genuine gap in "just write SQL, no ORM" as a convention: an ORM's query builder would have inferred the target column type automatically, while hand-written `INSERT ... SELECT ... UNION ALL` needs each branch's literals cast explicitly or Postgres falls back to `text`/`unknown` and only complains once it tries to assign that into the real column - a good reminder that this project's "plain SQL" choice trades some ergonomics for transparency, and multi-row seed data phrased as `UNION ALL` is exactly where that trade shows up. The visual QA round mattered for the same reason live-verification has mattered all project: a design change that "looks fine" in the file diff can still read as inconsistent once it's sitting next to other elements in the real rendered page, and only actually looking at it (twice, after each fix) caught that.

**AI mistake or oddity noticed?**
Not a functional bug this time, but a process note worth keeping: my first draft of the seed migration used bare `'owner'`/`'pending'`/`'2026-09-10'`/`'{design}'` literals exactly the way the single-row seed in `002_seed_demo_tasks.sql` gets away with (a plain `INSERT ... VALUES` lets Postgres infer the column type directly from the target), and I only discovered that pattern doesn't extend to a `UNION ALL`-based multi-row insert by running it against the live database and reading the actual Postgres type error - not by noticing it while writing the SQL. A smaller version of a lesson from Entries 18-19: a pattern that works in one place in this codebase doesn't automatically generalize to a structurally different use of the same feature.

---

### Entry 21 — custom columns, a floating assistant that can run the board, and the assistant as an auth bypass - 2026-09-06

**Prompt (exact):**
> floating button on the bottom to use the agent instead of tab still missing, need to be able to create task, boards, tasks inside the boards, assign to people if available, create collums etc
>
> use the mcps and skill (claude design) available for a better result

**Result obtained (summary):**
Three things. First, the design: drafted the floating assistant widget and the custom-column board as a design canvas with the Claude Design skill before writing any code, matching the app's existing tokens rather than inventing a look, then implemented from it. (The MCP servers configured in `.mcp.json` were all unavailable this session - `context7` and `serena` failed to connect, `playwright` never surfaced - so browser verification went through a throwaway Playwright container on the compose network, as in earlier slices.) Second, columns became real rows: a `board_columns` table with a backfill, `board_tasks.column_id` replacing `status` as what places a card, member-vs-owner-gated column routes, and a rewritten board page with per-column card composers, inline rename, an add-column tile and drag-and-drop rekeyed to columns. Third, the assistant moved from its own nav tab to a floating button available on every page, and gained tools for boards, columns, cards, assignment and membership - which meant `/api/chat` had to stop being anonymous, since it now acts as a specific user against permission-scoped data.

**Accepted / Corrected / Rejected:**
Security found a Critical I had left open: `add_board_member` wasn't in the destructive-tools set, so it ran with no confirmation, and its schema let the model pass `role: 'owner'`. Combined with an unbounded `users.name` that `list_users` feeds straight to the model, someone could register under a name full of instruction-shaped text and try to talk the assistant into making them owner of a board they were never on. Fixed by routing it through the confirmation flow, forcing the role to `member` and removing `role` from the schema entirely, capping name length, and fencing tool results as data in both the payload and the system prompt. Also fixed Security's finding that the 403 message named the board, which let anyone enumerate private board names through the chat. Review-QA separately caught that an assistant-driven card move (column without an explicit position) left the card colliding with whatever already sat in the target column, and that `list_board_tasks` gave the model the now-vestigial `status` field but not the column name - so "which cards are done?" would be answered from the wrong field. Both fixed, along with four smaller real ones (untrimmed column names, a duplicate PATCH when Enter both submitted and blurred the rename input, columns not refetched on the drag error path, a failed confirm stranding its own buttons). Rejected one suggestion after checking it: switching `column_id` to `ON DELETE RESTRICT` would put the invariant in the schema, but it would also break board deletion, where columns and cards cascade together in no guaranteed order - the locked service-level guard stays the protection, documented as such.

**Why:**
The interesting thing about this slice is that the security boundary moved without the code that enforces it moving. Board permissions live in Express middleware (`requireBoardMember`/`requireBoardOwner`), and the assistant doesn't go through Express routes at all - it calls services directly. So the moment the assistant learned about boards, every one of those middleware guards became irrelevant to it, and an entirely parallel authorization path had to exist and be correct. That's a general lesson about adding an agent to an existing app: the agent is a second front door, and access control written as HTTP middleware doesn't cover it.

**AI mistake or oddity noticed (third follow-up: several people per card)?**
No bug this time, but a design decision worth recording because the project had already taught it once. Adding multiple assignees could have been done additively - keep `assignee_id` as "the main one" and add a join table for the rest - which is less code and breaks nothing. That is exactly the shape of the `status` / `column_id` split that Review-QA flagged two slices earlier, where two fields both claimed to answer the same question and immediately drifted apart. So the column was backfilled into the join table and then dropped, making the join table the only answer to "who is on this card". The generalisable bit: when a field goes from one value to many, the cheap move is to keep the old field and bolt the new one beside it, and that is precisely how you end up with two sources of truth - a project that has already been burned by one should recognise the pattern on sight. A browser check on the new UI also caught something a unit test could not: the modal's "Remover X" buttons had the same accessible name as the board's member-panel buttons, so the label was ambiguous on the page; fixed in the component rather than by narrowing the test's selector, since the ambiguity was real for a screen-reader user too, not just for the test.

**AI mistake or oddity noticed (second follow-up: the first real conversation)?**
The single most valuable bug report of this project came from the user simply talking to the assistant. Asking "tarefas pendentes nos quadros" failed with the generic "nao foi possivel falar com o assistente", and the backend log showed why: `400 An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'`. My tool loop read `tool_calls[0]` and answered only that one, while the provider had batched several calls (one per board) into a single response - so the next request was malformed and the turn died. What makes this worth recording is how it hid: the code was written when the assistant had four single-target task tools, where a batched response essentially never happens, and it stayed correct-looking right up until boards gave the model a reason to fan out. Every test I had written exercised `executeTool` directly, so none of them ever produced a provider response at all, let alone one with two calls in it. The fix came with the test I should have had from the start - an injectable client, a fake response carrying two tool calls, and an assertion that both ids get answered - which costs nothing to run and would have caught this before the user ever saw it. The general lesson: when code integrates with an external protocol, the tests have to model the *protocol's* shapes (batched calls, empty results, error envelopes), not just my own functions; testing only my side of the boundary tests the half that wasn't going to break.

**AI mistake or oddity noticed (follow-up round)?**
The drag bug I shipped in this slice is worth its own note, because the fix was in the wrong mental model rather than the wrong line. I cleared the "currently dragging" state in `onDragEnd`, which is the obvious place and reads as correct - but moving a card to another column re-parents it in the React tree, so the browser unmounts the dragged node mid-drag and never delivers `dragend` at all. The state stayed set, and the card came back greyed until a reload. The lesson is about lifecycle rather than drag-and-drop: a cleanup hung on an event fired *by the element* is unreliable whenever the same interaction can destroy that element, and the safe place to clean up is the code path that already knows the interaction completed. The testing half is just as pointed - a synthetic mouse drag doesn't fire HTML5 drag events at all, and a test that politely dispatches `dragend` would have passed against the broken code. The test that actually catches this deliberately omits `dragend`, reproducing the exact condition the browser produces.

**AI mistake or oddity noticed?**
Yes, and it's the sharpest instance of a pattern that's now recurred across Entries 18, 19 and 21. I built the confirmation gate correctly for four tools, and then added a fifth tool - the one that hands out board access, arguably the most consequential of the lot - without adding it to the same set. Same shape as S5's `create()` missing the guard `destroy()` already had. The new wrinkle is *why* it was easy to miss here: `DESTRUCTIVE_TOOLS` reads as "things that damage data", and adding a member doesn't destroy anything, so it didn't pattern-match to the category name even though it's the highest-privilege action in the set. The category was named after the wrong property - what actually matters is "changes state that the user would want to approve first", not "destroys". I renamed nothing, but the comment above the set now says exactly that, because the next person adding a tool will make the same inference off the name that I did.
