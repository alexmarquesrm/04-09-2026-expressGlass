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
