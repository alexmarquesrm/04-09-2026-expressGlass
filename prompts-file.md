# Prompts File — registo de utilização de IA

Registo mantido em tempo real durante a construção do desafio ExpressGlass, para o `RELATORIO.md` final não precisar de ser reconstruído de memória. Os prompts ficam citados no idioma original (o que foi mesmo escrito); todo o resto está em português. Versão simplificada — para o histórico completo e mais detalhado, ver o histórico do Git deste ficheiro.

## Ferramentas e modelos usados

- **Claude Code** — agente principal, do início ao fim. Modelo: começou em Sonnet 5, passou a Opus 5 durante a maior parte do nível "stretch" (quadros, autenticação, permissões, assistente), voltou a Sonnet 5 no acabamento final.
- **Subagentes** (`.claude/agents/*.md`): `product`, `dev`, `security`, `review-qa`.
- **Skill de Claude Design** — mockups da interface antes do CSS real.
- **Context7, Serena e Playwright MCP** — configurados em `.mcp.json`, mas nunca chegaram a ligar nesta máquina; substituídos por navegação manual e por um contentor Docker descartável com Playwright.
- **APIs de LLM do chatbot** — construído primeiro contra a API da Claude, testado contra a API da Gemini, e por fim assente na API da DeepSeek (`deepseek-v4-flash`, via SDK `openai`), a pedido do utilizador.

## Modelo para novas entradas

```
### Entry N — <título curto> — <data>

**Prompt:**
> ...

Resultado: ...
Erro da IA: ...
```

<!-- Entradas começam aqui -->

### Entry 1 — scaffold inicial (M0/M1) — 2026-09-05

**Prompt:**
> lets start the project with docker files

Resultado: o Claude Code criou o repositório completo numa só vez (`CLAUDE.md`, subagentes, backend Express, frontend Vite/React, `docker-compose.yml`), avisando que nada disto tinha ainda corrido, já que não corre Docker/Node no seu próprio ambiente.
Erro da IA: sim — o primeiro `POST /api/tasks` falhou porque `COALESCE($4, 'medium')` não converte automaticamente para o tipo enum da coluna. Corrigido com `$4::task_priority` explícito. Só apareceu ao correr a stack a sério, não ao ler o código.

### Entry 2 — revisão pós M1/M2 — 2026-09-05

**Prompt:**
> Lets proceed to next step, always reviewing each phase we are doing

Resultado: `security` e `review-qa`, corridos em paralelo, encontraram os mesmos dois problemas por métodos diferentes (leitura de código vs. curl ao vivo): erros do Postgres a vazar para o cliente, e falta de validação de input. Corrigidos ambos, mais um `catch` em falta no frontend e os testes placeholder substituídos por 14 testes reais.
Erro da IA: não desta vez — mas as duas revisões independentes confirmarem o mesmo problema deu confiança extra de que não era um falso alarme.

### Entry 3 — mockup com Claude Design — 2026-09-05

**Prompt:**
> lets keep going then, and use a mcp for claude design for mockups

Resultado: mockup estático publicado com a skill de Design (não é um MCP) e depois implementado em CSS real.
Erro da IA: não foi um erro de código — mas a meio da tarefa o utilizador pediu para expandir tudo para um produto Trello completo, o que contrariava o âmbito definido em `CLAUDE.md`. Em vez de construir logo, perguntei se era só para o mockup, para âmbito novo, ou para roadmap futuro; o utilizador escolheu roadmap nessa altura.

### Entry 4 — rotas + verificação visual — 2026-09-05

**Prompt:**
> use the mockup from early to improve the UI, and let that be a diferent page from rest thats coming after separate so that i can show it

Resultado: `/` e `/assistant` como páginas separadas com uma navbar simples; verificado com Playwright a correr dentro de um contentor Docker descartável.
Erro da IA: o Vite bloqueava pedidos com um `Host` header diferente de `localhost` (proteção contra DNS-rebinding), o que rebentou a primeira tentativa de screenshot via contentor. Corrigido com `allowedHosts`.

### Entry 5 — editar/eliminar tarefas + bug de HMR — 2026-09-05

**Prompt:**
> update or delete task is a must, check every steps missing from the project plan and update if missing

Resultado: UI de edição/eliminação, com um diálogo de confirmação a substituir o `window.confirm` nativo.
Erro da IA: o código novo não aparecia na app a correr — o observador de ficheiros do Vite não deteta bem alterações através do bind-mount Windows→Docker. Corrigido com polling (`usePolling: true`). Só descoberto ao confirmar os bytes servidos via curl, não pela captura de ecrã.

### Entry 6 — filtros + UI em português — 2026-09-05

**Prompt:**
> now add a filter dropdown for priority, marked as done
>
> after that make the website in portuguese, clean up the tasks and add 3 or 4 tasks in portuguese too (seed database)

Resultado: filtros de prioridade/estado, e toda a interface traduzida para português.
Erro da IA: nenhum — passagem limpa, confirmada com Playwright.

### Entry 7 — seed migration + instruções no README — 2026-09-05

**Prompt:**
> add pre-added tasks to the docker run file
>
> on the readme update the end of the file to show how to run the docker and explain it

Resultado: as tarefas de demonstração viraram uma migração real, testada com `docker compose down -v` + `up` contra uma base de dados completamente limpa. Secção de instruções de arranque acrescentada ao README.
Erro da IA: nenhum.

### Entry 8 — extensão do chatbot (M4) + revisão — 2026-09-05

**Prompt:**
> next phase

Resultado: `/api/chat` com tool use (API da Claude), confirmação antes de ações destrutivas, tabela `audit_log`, UI de chat.
Erro da IA: sim, dois, ambos apanhados pela revisão de Segurança/Review-QA: o token de confirmação era o id sequencial da própria tabela (fácil de adivinhar) — trocado por um UUID aleatório; e o endpoint de confirmação respondia "sucesso" mesmo quando a tarefa alvo já não existia — corrigido para verificar o resultado real antes de responder.

### Entry 9 — troca do chatbot para Gemini — 2026-09-05

**Prompt:**
> i added a gemini key to test not anthropic

Resultado: o utilizador tinha posto uma chave da Gemini na variável errada; depois de esclarecido, o backend passou a usar a API da Gemini por completo, a pedido do utilizador.
Erro da IA: dois. O nome do modelo (`gemini-2.5-flash`) já não existia — corrigido com o nome certo devolvido pelo próprio erro da API. E a Gemini por vezes encadeia duas chamadas de ferramenta (uma para verificar antes de apagar) ou pede confirmação em texto simples em vez de chamar a ferramenta — o desenho original (uma só chamada) engolia isso silenciosamente. Corrigido com um ciclo limitado e uma instrução explícita no prompt do sistema.

### Entry 10 — um 502 genérico escondia um 429 real — 2026-09-05/06

**Prompt:**
> "Nao foi possivel falar com o assistente de momento. Tenta novamente." error on the chat

Resultado: a mensagem genérica de erro escondia a causa real — `429`, a chave gratuita da Gemini tinha esgotado a quota diária.
Erro da IA: sim — a correção de segurança da Entrada 8 (esconder erros do cliente) também apagava o erro real dos próprios registos do servidor. Corrigido para sempre registar o erro real no servidor antes de o disfarçar para o cliente.

### Entry 11 — segunda troca, Gemini → DeepSeek, com orçamento de custo — 2026-09-06

**Prompt:**
> changing to deepseek API afterall, use one request to test da API

Resultado: backend reescrito para a API da DeepSeek, com o pedido explícito de gastar no máximo uma chamada paga. Tudo o que era grátis (suite de testes, revisão de código, fluxo de confirmar/cancelar) correu primeiro; a única chamada real serviu só para confirmar o formato da resposta.
Erro da IA: pequeno — assumi que `docker compose restart` bastava depois de mudar uma variável de ambiente, quando só recriar o contentor relê o `docker-compose.yml`. Não custou nada, porque falhou antes de sequer contactar a API.

### Entry 12 — alarme falso de alucinação, e um bug real por baixo — 2026-09-06

**Prompt:**
> (gave it the output) - chatbot did output but i dont see the note "confirmar envio email" on the task list

Resultado: concluí à primeira que o chatbot tinha inventado uma tarefa inteira — diagnóstico errado. O utilizador tinha criado essa tarefa mesmo, ao vivo; a falha real era outra: a coluna `description` sempre existiu na base de dados mas nunca tinha sido mostrada em lado nenhum do frontend. Corrigido mostrando a descrição na lista, no formulário e na edição inline.
Erro da IA: sim, meu — saltar para "a IA alucinou" sem primeiro verificar a base de dados real. Lição: perante uma resposta estranha do chatbot, verificar sempre os dados reais antes de assumir que o modelo está errado.

### Entry 13 — datas em linguagem natural + bug de fuso horário — 2026-09-06

**Prompt:**
> lets go for the next phase

Resultado: o prompt do sistema passou a dizer explicitamente a data de hoje ao modelo, em vez de depender de um palpite implícito.
Erro da IA: quase — a forma óbvia de calcular "hoje" (`toISOString()`) é sempre UTC, o que dava o dia errado à noite em qualquer fuso horário à frente de UTC. Corrigido antes de causar problemas: lendo a data local em vez da UTC, e definindo `TZ=Europe/Lisbon` no contentor do backend.

### Entry 14 — revisão holística do M6 apanha uma regressão real — 2026-09-06

**Prompt:**
> lets check M6 then

Resultado: uma revisão pedida a olhar para a app inteira (não funcionalidade a funcionalidade) encontrou um bug já em produção: todas as datas-limite apareciam um dia mais cedo, porque Portugal está em horário de verão. Causa: o `TZ=Europe/Lisbon` da Entrada 13 teve um efeito secundário — o Postgres cria um objeto `Date` à meia-noite local, que o Express depois serializa em UTC, deslocando o dia. Corrigido fazendo o driver devolver a data como texto simples, nunca como `Date`.
Erro da IA: sim, e é o mesmo erro da Entrada 13, desta vez já em produção: verificar só que "hoje" estava certo não bastava — mudar `TZ` afeta tudo o resto que lê uma data, e ninguém tinha voltado a verificar isso.

### Entry 15 — S1, vários quadros — 2026-09-06

**Prompt:**
> on the end of the file theres the stretch tier, dont change whats done, just create the stretch tier on new routes
>
> All 5, in the plan's own order (Recommended)

Resultado: quadros (`boards`) construídos como ficheiros novos, sem tocar no que já existia. Segurança e Review-QA encontraram os mesmos dois problemas por ângulos diferentes: `position` sem validação (500 em vez de 400), e eliminar um quadro sem o diálogo de confirmação que o resto da app já usa. Ambos corrigidos.
Erro da IA: não de código — mas o meu primeiro teste com Playwright falhou por o browser (dentro do contentor) não conseguir resolver o backend real; resolvido ligando o contentor de teste à mesma rede Docker.

### Entry 16 — S2, arrastar e largar — 2026-09-06

**Prompt:**
> missing features - logins, multiples users, assign users to tasks, multiple boards etc

Resultado: drag-and-drop nativo (sem biblioteca nova) sobre a coluna `position` já existente.
Erro da IA: sim, um off-by-one — arrastar A para cima de C dava `[B,C,A]` em vez de `[B,A,C]`, porque o índice de destino era calculado contra a lista errada. Só apareceu ao verificar a ordem real no ecrã, não ao ler o código. Corrigido e reconfirmado.

### Entry 17 — S3, contas de utilizador e JWT — 2026-09-06

**Prompt:**
> aproach the next steps

Resultado: registo/login com JWT guardado num cookie httpOnly.
Erro da IA: quase — a lógica de registo verificava o email antes de inserir (um clássico "TOCTOU") sem apanhar a violação de unicidade da própria base de dados. Review-QA só conseguiu provar isto forçando duas chamadas em simultâneo, sem esperar pela latência normal de pedidos HTTP. Corrigido apanhando o erro `23505` do Postgres e devolvendo o mesmo 409 educado.

### Entry 18 — S4, atribuição de tarefas — 2026-09-06

**Prompt:**
> what about assigning tasks to users, and the next steps

Resultado: tarefas de quadro passaram a poder ser atribuídas a um utilizador.
Erro da IA: sim, dois. Descobri que os testes de autenticação da Entrada 17 nunca limpavam os utilizadores que criavam — mais de 14 contas de lixo acumuladas na base de dados de desenvolvimento; corrigido com a mesma limpeza que outros ficheiros de teste já usavam. Segurança também encontrou `GET /api/users` a expor o email de todos sem exigir login — removido da resposta.

### Entry 19 — S5, permissões por quadro — 2026-09-06

**Prompt:**
> lets add the last step, the permissions per board, and make sure all routes are protected by the middleware

Resultado: papéis de dono/membro por quadro, com middleware a proteger todas as rotas de quadros e tarefas.
Erro da IA: sim, grave — o endpoint de adicionar ou mudar o papel de um membro não tinha a proteção "não podes ficar sem dono nenhum" que o endpoint de remover já tinha, o que deixava o próprio dono despromover-se a si mesmo por engano e trancar toda a gente fora do quadro. Nenhum dos 62 testes existentes até então testava as rotas HTTP reais, só a camada de serviço — por isso ninguém tinha visto o buraco. Corrigido com a proteção em falta e, pela primeira vez, testes HTTP reais.

**Nível "stretch" completo.** S1 a S5 construídos, revistos e corrigidos.

### Entry 20 — dados de exemplo + visual estilo Trello — 2026-09-06

**Prompt:**
> seed the whole database, and default users too

Resultado: migração a semear 4 utilizadores, 3 quadros e tarefas atribuídas; visual dos quadros redesenhado para se aproximar dos prints do Trello enviados pelo utilizador.
Erro da IA: não funcional — mas a migração falhou duas vezes antes de correr, porque o Postgres não converte automaticamente literais soltos para tipos enum/data/array dentro de um `INSERT ... SELECT` com `UNION ALL`, ao contrário de um `INSERT ... VALUES` simples. Corrigido com conversões explícitas (`::board_role`, `::task_status`, `::date`, etc.).

### Entry 21 — colunas personalizadas, assistente flutuante, e o assistente como porta lateral de autorização — 2026-09-06

**Prompt:**
> floating button on the bottom to use the agent instead of tab still missing, need to be able to create task, boards, tasks inside the boards, assign to people if available, create collums etc
>
> use the mcps and skill (claude design) available for a better result

Resultado: as colunas de um quadro tornaram-se reais (tabela `board_columns`, com colunas criadas/renomeadas/apagadas pelo utilizador), e o assistente de chat passou de separador próprio a botão flutuante disponível em qualquer página, com ferramentas para gerir quadros, colunas, cartões e membros.

Erro da IA: sim, crítico. O assistente chama os serviços diretamente, sem passar pelas rotas Express — por isso as proteções de permissão escritas como middleware do Express não se aplicavam a ele. A Segurança encontrou a ferramenta de adicionar membros sem exigir confirmação e a deixar o modelo escolher o cargo "dono"; combinado com um nome de utilizador sem limite de tamanho, alguém podia tentar convencer o assistente a promovê-lo a dono de um quadro onde nunca esteve. Corrigido em várias frentes: confirmação obrigatória, cargo sempre fixo a "membro", limite de tamanho no nome, e os resultados das ferramentas marcados como dados, nunca como instruções.

Mais quatro coisas encontradas ao usar a funcionalidade a sério, já depois desta revisão:

- **Bug de arrastar:** um cartão movido para outra coluna ficava cinzento até a página ser recarregada, porque mover um cartão entre colunas faz o React desmontar o elemento a meio do arrasto, e o evento `dragend` nunca chega a disparar. Corrigido limpando o estado no sítio onde a mudança é confirmada, não à espera desse evento.
- **A primeira conversa real:** perguntar "tarefas pendentes nos quadros" falhava sempre, porque o fornecedor de IA por vezes devolve várias chamadas de ferramenta na mesma resposta, e o código só respondia à primeira — invalidando o pedido seguinte e derrubando a conversa. Corrigido para responder a todas. Nenhum teste anterior podia ter apanhado isto, porque todos chamavam as ferramentas diretamente, sem passar por uma resposta real do fornecedor.
- **Várias pessoas por cartão:** em vez de manter a antiga coluna `assignee_id` a par de uma tabela nova (o que teria repetido o mesmo erro de duas fontes de verdade já visto antes com `status`/`column_id`), a coluna foi passada para uma tabela de junção e depois removida.
- **Um quinto erro do mesmo tipo:** tal como antes, uma ferramenta nova (adicionar membro) foi construída sem herdar a proteção de confirmação que as outras quatro já tinham — o mesmo tipo de esquecimento das Entradas 18 e 19, desta vez na lista de "ações destrutivas" do assistente.

### Entry 22 — uma revisão "o que falta" torna-se testes de frontend + CI — 2026-09-06

**Prompt:**
> now we need to review everything that's missing

Resultado: uma revisão ao repositório real (não à memória de sessões antigas) mostrou que o backend tinha 99 testes e o frontend tinha zero, e nada corria automaticamente. Acrescentados Vitest + React Testing Library (frontend) e um workflow do GitHub Actions a correr as duas suites em cada push/pull request.
Erro da IA: sim, encontrado pela revisão, não a correr nada — um teste chamado "envia o título sem espaços" verificava, na prática, um valor com espaços intactos, porque `TaskForm.jsx` só limpava a descrição, nunca o título (ao contrário do `TaskModal.jsx`, que limpa os dois). O teste e o componente concordavam entre si, só que ambos estavam errados. Corrigido o componente e o teste.

---

Ver [RELATORIO.md](RELATORIO.md) para o resumo final desta informação.
