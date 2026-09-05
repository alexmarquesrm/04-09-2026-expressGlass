# ExpressGlass — Take-home challenge

Current focus: producing the technical take-home exercise for the ExpressGlass application.

---

## 1. Exercise brief (transcribed from the provided document)

**Objective:** build a small full-stack application, using AI tools as a core part of the development process, not just for autocompleting stray lines.

**Back-end:** create a simple API, connected to a local database, that allows managing a list of tasks: at minimum, create and list tasks. Edit and delete are a bonus, not mandatory.

**Front-end:** develop a simple web interface to interact with that API — at minimum, create a new task and see the updated list.

**Process report:** deliver, along with the code, a short document (can be a `RELATORIO.md` file in the same repository) describing:
- Which AI tools or models you used
- Two or three examples of prompts you gave, with the result obtained
- What you accepted as the AI generated it, and what you had to correct or reject, and why
- Any moment where the AI produced something incorrect or strange, and how you noticed it

**Delivery:** send the source code and the report, for example via a Git repository.

**Notes:** no restriction on technology or AI tool to use.

---

## 2. Chosen approach

**Chosen stack:** Node.js (Express) on the backend + local PostgreSQL + React on the frontend — this is where the candidate has the most experience and fluency, given there's no technology restriction.

**Docker:** the whole stack (Postgres + backend, optionally frontend) runs via `docker-compose`, so the reviewer can clone the repo and have it running with a single `docker compose up` instead of installing Postgres/Node locally themselves — one less friction point when someone else is grading the delivery. Concrete compose/Dockerfile layout is in [PROJECT-PLAN.md](PROJECT-PLAN.md).

**Project structure with Claude Code:**

```
project/
├── CLAUDE.md                 ← project context (stack, conventions, rules)
├── docker-compose.yml         ← one command to run db + backend (+ frontend)
├── .claude/
│   └── agents/
│       ├── product.md
│       ├── dev.md
│       ├── security.md
│       └── review-qa.md
├── RELATORIO.md               ← filled in throughout the process
├── prompts-file.md            ← raw log of all prompts used
├── backend/
└── frontend/
```

**Role of each subagent (Claude Code — `.claude/agents/*.md`, markdown with YAML frontmatter: `name`, `description`, `tools`, body = system prompt):**
- **Product**: only defines requirements/acceptance criteria, doesn't write code (tools: read-only)
- **Dev**: implements the code (tools: Read, Write, Edit, Bash)
- **Security**: reviews code for vulnerabilities (injection, input validation), only reports, doesn't fix directly (tools: read-only)
- **Review/QA**: runs tests, validates against Product's criteria, gives structured feedback (critical/warning/suggestion)

**MCPs to use:**
- **[Context7](https://github.com/upstash/context7)** — pulls up-to-date documentation for React/TS/Node/Express/pg/Anthropic SDK on demand, so agents don't suggest deprecated APIs. Solves *knowledge staleness*.
- **[Serena](https://github.com/oraios/serena)** — LSP-backed semantic code toolkit: symbol-level navigation and edits ("find all references to `createTask`", "go to definition") instead of raw-text grepping. Solves *code navigation*, and pays off as soon as the codebase has more than a couple of files. Trade-off: needs a language server + `uv`/Python installed locally — worth setting up once at project start rather than mid-build. Gives the Dev/Security/Review agents more precise, cheaper (fewer tokens) lookups and cleaner diffs.
- **[Playwright MCP](https://playwright.dev/docs/getting-started-mcp)** — drives a real (headless) browser: navigate, click, fill forms, screenshot. Solves *verifying the UI actually renders and works*, not just that it compiles. Before this was added, confirming the frontend visually required improvising a one-off Playwright script run inside a throwaway Docker container (see `prompts-file.md`) — this MCP replaces that with a supported, repeatable path for the Dev/Review-QA agents to check real rendered output, not just code.

All three are complementary (docs freshness / code navigation / live UI verification), so all go in `.mcp.json` at project root — see [PROJECT-PLAN.md](PROJECT-PLAN.md) for the config.

**Prompt logging discipline:**
Keep a separate [prompts-file.md](prompts-file.md), filled in real time (exact prompt → summarized response → accepted/rejected and why), so there's no need to reconstruct it from memory at the end. At the end, pick the 2-3 best examples for the final `RELATORIO.md`.

**Scoping note:** prioritize the core (create/list tasks end-to-end, functional and stable) before any extension. The chatbot extension (section 3) only proceeds if the core is solid — and that scoping decision is itself worth noting in the report.

---

## 3. Extension: integrated chatbot for conversational management

**Idea:** besides the manual UI (create/list/search tasks), add an LLM-powered chatbot that manages everything via natural language — creating tasks, searching, returning information, creating automations — using **tool use / function calling**.

**Architecture:**

```
User → Chat UI → Backend (/chat endpoint) → LLM (Claude API) → decides which tool to call
                                                          ↓
                                              Tools: create_task(), list_tasks(),
                                                     search_task(query),
                                                     create_automation(rule)
                                                          ↓
                                              Backend executes the real function → Postgres
                                                          ↓
                                              Result goes back to the LLM → natural language response
```

**Step-by-step flow:**
1. User writes in the chat (e.g. "create a task for tomorrow about reviewing the report")
2. Message sent to the Claude API along with the available tool definitions (JSON schema: name, parameters, when to use)
3. Claude decides which tool matches and returns the extracted parameters (`tool_use`)
4. Backend executes the real function (inserts into the DB)
5. Result goes back to Claude, which generates the final natural-language response

**Two ways to expose the tools:**
- **Direct function calling** in the own API (simpler and faster — recommended for the challenge)
- **Via an MCP server** — more aligned with good architecture practice (decouples the LLM from the specific backend), but more work for a small challenge. Worth mentioning in the report as a natural evolution, without over-engineering the delivery.

**Example tools to define:**
```
- create_task(title, description?, due_date?)
- list_tasks(filter?: "pending" | "completed" | "all")
- search_task(query: string)
- update_task(id, fields)
- delete_task(id)
- create_automation(trigger, action)
```

**Note on automations:** use the LLM to **configure** the rule (interpret the natural-language request and store the structured rule in the DB), not to **execute** it every time — cheaper, more predictable, and a good point to highlight in the report (it shows judgment about when to use/not use AI at runtime).

---

## 4. Feature roadmap

Ordered by signal-to-effort ratio — 1 and 2 are treated as near-free must-haves given how directly they map to the job ad's "know when to trust AI" framing; 3-4 are nice-to-have differentiators if time allows; 5 is report material more than a shippable feature.

1. **Confirmation step before destructive chat actions** (delete/update via natural language) — cheap to add, directly demonstrates not blindly trusting AI-driven actions.
2. **Audit trail** for chat-triggered actions (message → tool call → DB write) — mirrors the same idea used in the email-automation interview answer; shows AI-in-production judgment.
3. **Tags/priority on tasks** — trivial schema addition, makes the list UI read as a real product instead of a bare CRUD demo.
4. **Natural-language due dates** ("tomorrow", "next Friday") parsed by the LLM into a real date — small, flashy, cheap.
5. **Basic AI-assisted tests** for the API, explicitly logged in `prompts-file.md` as a "what I reviewed and corrected" example — strengthens the report without much build time.

**Stretch tier (post-take-home ambition, only if 1-5 are done and time genuinely allows):** a Trello-style evolution of the app — multiple boards, drag-and-drop between status columns, user accounts/auth, assigning tasks to specific people, and per-board permissions (who can view/edit a given board). This is a materially larger build than the take-home brief asks for (auth + multi-tenancy alone is a significant chunk of work), so it's tracked here as direction, not a commitment — the core simple task list stays the actual deliverable regardless of whether any of this gets built.

---

## 5. Open next steps

- Full concrete project structure (directory tree, DB schema, API contract, Docker setup, MCP config, agent files) is in [PROJECT-PLAN.md](PROJECT-PLAN.md) — that's the reference to start scaffolding from
- Decide whether to move on to scaffolding the code now (CLAUDE.md + agents + backend/frontend skeleton)
- Implement the take-home challenge with the architecture defined above
