# RELATÓRIO — ExpressGlass Take-Home Challenge

## English

### AI tools and models used

- **Claude Code (Sonnet 5)** — main development agent for the whole project: scaffolding, backend/frontend implementation, debugging, and orchestration of the sub-agents below.
- **Custom sub-agents** (`.claude/agents/*.md`): `product` (requirements only, read-only), `dev` (implementation), `security` and `review-qa` (independent review passes, report-only — see the example below).
- **Claude Design skill** — used to draft a UI mockup (published as a separate Artifact) before writing the real frontend CSS, so layout/color/typography decisions were settled visually first.
- **Context7 and Serena MCP servers** — configured in `.mcp.json` for live library docs and semantic code navigation. Honesty note: both failed to connect during parts of this session (`CONNECTION_CLOSED`); development continued without them rather than blocking on it, which is itself a small example of not over-depending on AI tooling when it's unavailable.

### Example prompts and results

**1. "Let's start the project with docker files"**
Result: Claude Code scaffolded the entire repo in one pass — `CLAUDE.md`, `.mcp.json`, the four sub-agent definitions, a full Express backend (routes → controllers → services, parameterized SQL, a startup migration runner), a minimal React/Vite frontend, and a three-service `docker-compose.yml`. It was explicit that it couldn't actually run Docker/Node in its own sandbox, so none of it had been executed yet — an honest limitation rather than a claimed "it works."

**2. "Lets proceed to next step, always reviewing each phase we are doing"**
Result: the `security` and `review-qa` sub-agents were run in parallel against the just-scaffolded core. They independently converged on the same two real issues (raw Postgres error messages leaking to API clients, and missing input validation before hitting the DB) via two different methods — one by reading the code, one by live-probing the running API with curl — which made the finding high-confidence rather than a stylistic nitpick. Both were fixed, along with replacing a placeholder test file with 14 real unit + integration tests.

**3. "Use a mcp for claude design"**
Result: used the Claude Design skill to draft a static UI mockup, then implemented matching styling in the real app. Mid-task, a follow-up message asked to pivot the mockup toward a full Trello-style product (multiple boards, drag-and-drop, auth, task assignment, permissions) — a large, undiscussed scope expansion that contradicted the project's own documented scope (`CLAUDE.md`: "core is non-negotiable... chatbot and roadmap are additive"). Rather than building it outright, the assistant paused and asked whether this was meant for the mockup only, as new real scope, or as an incremental roadmap addition. The user chose the roadmap option, confirming the core submission stays the simple task list.

### What was accepted as-is vs. corrected or rejected, and why

- **Accepted as-is:** the overall project structure, the routes → controllers → services layering, and the bulk of the CRUD implementation matched the stated conventions and needed no changes.
- **Corrected:** an SQL bug in task creation (see below), raw error-message leakage to API clients, missing input validation, a missing `catch` around a frontend API call, and a placeholder test file that claimed to pass without testing anything real.
- **Rejected / deferred:** the Trello-style expansion (multi-board, drag-and-drop, auth, assignment, permissions) was deliberately not built now — tracked in `PROJECT-PLAN.md` as a "stretch tier" instead, since it's a materially larger product than the take-home brief asks for and building it now risked not finishing the actual core cleanly.

### An AI mistake, and how it was caught

The first live test of `POST /api/tasks` failed with `column "priority" is of type task_priority but expression is of type text`. The generated SQL was `COALESCE($4, 'medium')` inserting into an enum column; Postgres can't infer that a bound parameter inside `COALESCE` should be cast to the enum type, so it defaulted to `text` and the insert failed. This looked completely correct on a static read of the code — it only surfaced once the container was actually run against real Postgres and exercised with `curl`. Fixed with explicit casts (`$4::task_priority`, `$5::text[]`). This is the concrete reason the workflow leaned on actually running `docker compose up` and hitting the live API at every milestone, instead of trusting generated code by inspection alone.

---

## Português

### Ferramentas e modelos de IA usados

- **Claude Code (Sonnet 5)** — agente principal de desenvolvimento: scaffolding, implementação de backend/frontend, depuração, e orquestração dos subagentes abaixo.
- **Subagentes personalizados** (`.claude/agents/*.md`): `product` (apenas requisitos, só leitura), `dev` (implementação), `security` e `review-qa` (revisões independentes, apenas reportam — ver exemplo abaixo).
- **Skill de Claude Design** — usada para desenhar um mockup da interface (publicado como um Artifact separado) antes de escrever o CSS real, para decidir layout/cores/tipografia visualmente primeiro.
- **Servidores MCP Context7 e Serena** — configurados em `.mcp.json` para documentação de bibliotecas em tempo real e navegação semântica de código. Nota de transparência: ambos falharam a ligar durante parte desta sessão (`CONNECTION_CLOSED`); o desenvolvimento continuou sem eles em vez de bloquear por causa disso — um pequeno exemplo de não depender excessivamente de ferramentas de IA quando indisponíveis.

### Exemplos de prompts e resultados

**1. "Let's start the project with docker files"**
Resultado: o Claude Code fez o scaffolding de todo o repositório numa só vez — `CLAUDE.md`, `.mcp.json`, as quatro definições de subagentes, um backend Express completo (routes → controllers → services, SQL parametrizado, um runner de migrações no arranque), um frontend React/Vite mínimo, e um `docker-compose.yml` com três serviços. Foi explícito que não conseguia correr Docker/Node no seu próprio ambiente, logo nada tinha ainda sido executado — uma limitação assumida em vez de uma afirmação de que "funciona".

**2. "Lets proceed to next step, always reviewing each phase we are doing"**
Resultado: os subagentes `security` e `review-qa` foram corridos em paralelo sobre o núcleo recém-criado. Convergiram de forma independente para os mesmos dois problemas reais (mensagens de erro do Postgres a vazar para o cliente da API, e falta de validação de input antes de chegar à base de dados) através de dois métodos diferentes — um a ler o código, outro a testar a API a correr com curl — o que tornou o achado de alta confiança em vez de um capricho de estilo. Ambos foram corrigidos, junto com a substituição de um ficheiro de testes placeholder por 14 testes reais (unitários + integração).

**3. "Use a mcp for claude design"**
Resultado: usada a skill de Claude Design para desenhar um mockup estático da interface, seguido da implementação do estilo correspondente na aplicação real. A meio da tarefa, uma mensagem seguinte pediu para transformar o mockup num produto completo estilo Trello (vários quadros, drag-and-drop, autenticação, atribuição de tarefas, permissões) — uma expansão de âmbito grande e não discutida, que contradizia o âmbito já documentado do projeto (`CLAUDE.md`: "o núcleo é inegociável... o chatbot e o roadmap são aditivos"). Em vez de construir isso diretamente, o assistente parou e perguntou se isto era para o mockup apenas, para um novo âmbito real, ou para uma adição incremental ao roadmap. O utilizador escolheu a opção de roadmap, confirmando que a entrega principal continua a ser a lista de tarefas simples.

### O que foi aceite tal como gerado vs. corrigido ou rejeitado, e porquê

- **Aceite tal como gerado:** a estrutura geral do projeto, a camada routes → controllers → services, e a maior parte da implementação de CRUD corresponderam às convenções definidas e não precisaram de alterações.
- **Corrigido:** um bug de SQL na criação de tarefas (ver abaixo), vazamento de mensagens de erro em bruto para o cliente da API, falta de validação de input, um `catch` em falta à volta de uma chamada à API no frontend, e um ficheiro de testes placeholder que dizia passar sem testar nada real.
- **Rejeitado / adiado:** a expansão estilo Trello (vários quadros, drag-and-drop, autenticação, atribuição, permissões) foi deliberadamente não construída agora — está registada no `PROJECT-PLAN.md` como um "nível stretch", por ser um produto substancialmente maior do que o pedido do enunciado, e construir isso agora arriscaria não terminar bem o núcleo real.

### Um erro da IA, e como foi detetado

O primeiro teste real de `POST /api/tasks` falhou com `column "priority" is of type task_priority but expression is of type text`. O SQL gerado era `COALESCE($4, 'medium')` a inserir numa coluna enum; o Postgres não consegue inferir que um parâmetro vinculado dentro de `COALESCE` deve ser convertido para o tipo enum, por isso assumiu `text` por omissão e o insert falhou. Isto parecia completamente correto numa leitura estática do código — só surgiu quando o contentor foi de facto corrido contra Postgres real e testado com `curl`. Corrigido com conversões explícitas (`$4::task_priority`, `$5::text[]`). Esta é a razão concreta pela qual o processo de trabalho passou a depender de correr sempre `docker compose up` e testar a API a correr em cada fase, em vez de confiar no código gerado apenas por inspeção.

---

See [prompts-file.md](prompts-file.md) for the full, unfiltered prompt log this report was distilled from. / Ver [prompts-file.md](prompts-file.md) para o registo completo e não filtrado de prompts de onde este relatório foi resumido.
