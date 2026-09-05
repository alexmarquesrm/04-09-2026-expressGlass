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
