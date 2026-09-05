# CLAUDE.md — project context

ExpressGlass take-home challenge: a task-management app (Node/Express + PostgreSQL + React) built with AI tools as a core part of the process. Full brief and rationale: [expressglass-task.md](expressglass-task.md). Concrete build reference: [PROJECT-PLAN.md](PROJECT-PLAN.md).

## Run it

```
docker compose up
```

Backend on `:3001`, frontend on `:5173`, Postgres on `:5432`. Copy `.env.example` to `.env` first (fill `ANTHROPIC_API_KEY` only if working on the chatbot extension).

## Conventions

- **SQL:** parameterized queries only (`pg` placeholders `$1, $2...`), never raw string interpolation into a query.
- **Backend layering:** routes → controllers → services. Controllers stay thin (parse/validate input, call a service, shape the response); business logic and DB calls live in services.
- **Migrations:** plain numbered `.sql` files in `backend/src/db/migrations/`, applied in order on container start. No ORM.
- **Errors:** thrown/rejected up to the single `errorHandler` middleware — no ad-hoc `res.status().json()` scattered in controllers for error cases.
- **Frontend:** functional components + hooks, no class components. API calls isolated in `frontend/src/api/`.
- **Prompt log:** every non-trivial AI prompt used while building this goes in [prompts-file.md](prompts-file.md) as it happens, not reconstructed later.

## Subagents

See [PROJECT-PLAN.md](PROJECT-PLAN.md) section 6 for the full table. Defined in `.claude/agents/`: `product.md` (requirements only, read-only), `dev.md` (implements code), `security.md` (reviews, doesn't fix), `review-qa.md` (tests + structured feedback).

## Scope

Core (task CRUD API + web UI) is the non-negotiable deliverable. The chatbot extension and feature roadmap are additive — only build them once the core is solid and demoable.
