# ExpressGlass — Take-Home Challenge

## English

A small full-stack task-management app built as the technical take-home exercise for the ExpressGlass Software Developer (Full Stack, AI & Automation) application.

**The problem:** build a task list — an API backed by a local database (create/list required, edit/delete as a bonus) and a simple web UI to create tasks and see the updated list — while using AI tools as a core part of the development process, not just for autocomplete. The deliverable includes a `RELATORIO.md` documenting the prompts used, what was accepted vs. corrected, and any AI mistakes caught along the way.

**Stack:** Node.js (Express) + PostgreSQL + React.

See [expressglass-task.md](expressglass-task.md) for the full exercise brief and the detailed approach (subagent setup, MCPs, optional chatbot extension), [PROJECT-PLAN.md](PROJECT-PLAN.md) for the concrete build structure, [prompts-file.md](prompts-file.md) for the running AI-prompt log, and [RELATORIO.md](RELATORIO.md) for the process report.

---

## Português

Uma pequena aplicação full-stack de gestão de tarefas, construída como desafio técnico para a candidatura à ExpressGlass (Software Developer Full Stack, IA & Automação).

**O problema:** construir uma lista de tarefas — uma API ligada a uma base de dados local (criar/listar obrigatório, editar/remover como valor acrescentado) e uma interface web simples para criar tarefas e ver a lista atualizada — usando ferramentas de IA como parte central do processo de desenvolvimento, não apenas para autocompletar. A entrega inclui um `RELATORIO.md` a documentar os prompts usados, o que foi aceite vs. corrigido, e eventuais erros da IA detetados pelo caminho.

**Stack:** Node.js (Express) + PostgreSQL + React.

Ver [expressglass-task.md](expressglass-task.md) para o enunciado completo e a abordagem detalhada (setup de subagentes, MCPs, extensão opcional de chatbot), [PROJECT-PLAN.md](PROJECT-PLAN.md) para a estrutura concreta de construção, [prompts-file.md](prompts-file.md) para o registo contínuo de prompts de IA, e [RELATORIO.md](RELATORIO.md) para o relatório do processo.

---

## Running it / Como executar

```
cp .env.example .env
docker compose up
```

That single command starts three containers:

- **`db`** — Postgres 16, with a health check that gates the other two services.
- **`backend`** — Express API on [http://localhost:3001](http://localhost:3001). On startup it runs any pending SQL migrations in `backend/src/db/migrations/` (in order, tracked so each one only ever runs once) before the server starts — including a seed migration that pre-populates the task list with 4 sample tasks, so the app isn't empty on first run.
- **`frontend`** — the React UI (Vite dev server) on [http://localhost:5173](http://localhost:5173), the interface you actually click through: [http://localhost:5173/](http://localhost:5173/) for the task list (already in Portuguese), [http://localhost:5173/assistant](http://localhost:5173/assistant) for the chatbot placeholder.

Only fill in `DEEPSEEK_API_KEY` in `.env` if you're working on the chatbot extension (M4) — the core task list doesn't need it. To stop everything: `docker compose down` (add `-v` to also wipe the database and get a fresh seeded state next time).

---

Este único comando arranca três contentores:

- **`db`** — Postgres 16, com um health check que condiciona o arranque dos outros dois serviços.
- **`backend`** — a API Express em [http://localhost:3001](http://localhost:3001). No arranque corre as migrações SQL pendentes em `backend/src/db/migrations/` (por ordem, cada uma só corre uma vez) antes de iniciar o servidor — incluindo uma migração de seed que pré-popula a lista com 4 tarefas de exemplo, para a aplicação não aparecer vazia na primeira execução.
- **`frontend`** — a interface React (servidor de desenvolvimento Vite) em [http://localhost:5173](http://localhost:5173): [http://localhost:5173/](http://localhost:5173/) para a lista de tarefas (já em português), [http://localhost:5173/assistant](http://localhost:5173/assistant) para o placeholder do chatbot.

Só é preciso preencher `DEEPSEEK_API_KEY` no `.env` se estiver a trabalhar na extensão de chatbot (M4) — o núcleo da aplicação não precisa disso. Para parar tudo: `docker compose down` (acrescentar `-v` também apaga a base de dados, ficando com um estado inicial semeado limpo na próxima vez).
