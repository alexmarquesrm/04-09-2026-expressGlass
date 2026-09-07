# Prompts File — registo de utilização de IA

Organizado à volta dos 3 pontos que o enunciado pede no relatório de processo: exemplos de prompts com resultado, o que foi aceite tal como gerado vs. corrigido/rejeitado, e um momento em que a IA produziu algo incorreto ou estranho. Os prompts citados ficam no idioma original (o que foi mesmo escrito); o resto está em português. O histórico completo e detalhado de todo o projeto (todas as fases, uma a uma) fica no histórico do Git deste ficheiro, para quem quiser mais contexto.

## Ferramentas e modelos usados

- **Claude Code** — agente principal, do início ao fim. Modelo: começou em Sonnet 5, passou a Opus 5 durante a maior parte do nível "stretch" (quadros, autenticação, permissões, assistente), voltou a Sonnet 5 no acabamento final.
- **Subagentes** (`.claude/agents/*.md`): `product`, `dev`, `security`, `review-qa`.
- **Skill de Claude Design** — mockups da interface antes do CSS real.
- **Context7, Serena e Playwright MCP** — configurados em `.mcp.json`, mas nunca chegaram a ligar nesta máquina; substituídos por navegação manual e por um contentor Docker descartável com Playwright.
- **APIs de LLM do chatbot** — construído primeiro contra a API da Claude, testado contra a API da Gemini, e por fim assente na API da DeepSeek (`deepseek-v4-flash`, via SDK `openai`), a pedido do utilizador.

## Exemplos de prompts e resultados

**1. Arranque do projeto**
> lets start the project with docker files

O Claude Code criou o repositório completo numa só vez: `CLAUDE.md`, subagentes, backend Express, frontend Vite/React, `docker-compose.yml` — avisando desde logo que nada disto tinha ainda corrido, já que não corre Docker/Node no seu próprio ambiente.

**2. Trocar de fornecedor de IA a meio do projeto, com orçamento**
> changing to deepseek API afterall, use one request to test da API

O chatbot já tinha sido construído e testado contra duas APIs diferentes (Claude, depois Gemini); esta terceira troca veio com uma condição explícita — gastar no máximo uma chamada paga à API real. Tudo o que não custava nada (suite de testes, revisão de código, fluxo de confirmar/cancelar) correu primeiro; a única chamada paga serviu só para confirmar o formato exato da resposta da API.

**3. Assistente flutuante com acesso aos quadros**
> floating button on the bottom to use the agent instead of tab still missing, need to be able to create task, boards, tasks inside the boards, assign to people if available, create collums etc
>
> use the mcps and skill (claude design) available for a better result

O assistente de chat passou de separador próprio a botão flutuante disponível em qualquer página, com ferramentas para gerir quadros, colunas, cartões e membros. Só foi considerado "feito" depois de uma revisão de segurança dedicada, que encontrou e corrigiu uma falha crítica (ver secção seguinte).

## O que foi aceite tal como gerado, vs. corrigido ou rejeitado

- **Aceite tal como gerado:** a estrutura geral do projeto (routes → controllers → services), SQL sempre parametrizado, e a maior parte do CRUD de tarefas e quadros.
- **Corrigido:**
  - Um bug de SQL logo no primeiro teste real — `COALESCE` a inserir texto numa coluna do tipo enum, sem conversão explícita. Só apareceu ao correr a aplicação a sério, não ao ler o código.
  - Um token de confirmação de ações destrutivas do chatbot que era apenas o id sequencial da tabela (fácil de adivinhar) — trocado por um UUID aleatório.
  - Um bug de fuso horário que atrasava a data-limite de todas as tarefas em um dia — efeito secundário de uma correção anterior, só descoberto numa revisão a olhar para a aplicação inteira em conjunto, não funcionalidade a funcionalidade.
  - Uma falha de segurança crítica em que o assistente de chat podia ser convencido, através de texto escondido no nome de um utilizador, a promover alguém a dono de um quadro onde nunca esteve. Corrigido exigindo sempre confirmação nessa ação, retirando ao modelo a possibilidade de escolher o cargo, e tratando o que as ferramentas devolvem como dados — nunca como instruções.
  - Um bug em que o assistente falhava sempre que o fornecedor de IA devolvia mais do que uma chamada de ferramenta na mesma resposta — só apareceu numa conversa real do utilizador, nunca em nenhum teste anterior.
- **Rejeitado:** simplificar a eliminação em cascata entre colunas e tarefas de um quadro — quebraria a ordem garantida ao apagar um quadro inteiro; manteve-se a proteção já existente ao nível do serviço.

## Um momento em que a IA produziu algo estranho, e como percebi isso

> (gave it the output) - chatbot did output but i dont see the note "confirmar envio email" on the task list

O utilizador colou uma conversa em que o assistente descrevia uma tarefa — título, hora, e uma nota sobre confirmar um email — que não correspondia a nenhuma das tarefas de demonstração que eu conhecia. A conclusão óbvia foi que o chatbot tinha inventado uma tarefa inteira, uma falha grave para uma ferramenta cuja função é executar ações reais na base de dados. Essa conclusão estava errada: o utilizador tinha criado essa tarefa mesmo, ao vivo, através do próprio chatbot, num passo que eu não tinha visto. Ao verificar a linha real na base de dados — em vez de ficar pela primeira explicação que parecia plausível — descobri a causa verdadeira: a coluna `description` sempre existiu e sempre funcionou desde o início do projeto, mas nunca tinha sido mostrada em lado nenhum da interface; o chatbot foi só a primeira coisa a preenchê-la com conteúdo real. A lição: perante uma resposta estranha de um chatbot, verificar sempre os dados reais antes de assumir que o modelo é que está errado.

---

Ver [RELATORIO.md](RELATORIO.md) para o relatório final. O histórico completo deste ficheiro (todas as fases do projeto, uma a uma) está disponível no histórico do Git.
