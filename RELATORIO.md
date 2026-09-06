# RELATÓRIO — ExpressGlass Take-Home Challenge

## Sobre este relatório

O enunciado pedia uma aplicação simples: uma API para criar e listar tarefas, ligada a uma base de dados local, e uma interface web para as usar — foi isso que entreguei primeiro, com Node/Express + PostgreSQL + React. Depois de entregue esse núcleo, o projeto continuou a crescer a pedido, passo a passo, até se tornar um gestor de tarefas em quadros com contas de utilizador e um assistente de chat. As secções seguintes descrevem o processo (ferramentas, prompts, o que foi aceite/corrigido, um erro da IA) tal como o enunciado pede; a última secção resume, de forma simples, o que foi acrescentado depois do núcleo e para que serve cada coisa.

## Ferramentas e modelos de IA usados

- **Claude Code** — agente principal de desenvolvimento, do início ao fim do projeto: scaffolding, backend, frontend, testes, depuração e orquestração dos subagentes abaixo. O modelo por trás mudou ao longo do projeto: começou em Sonnet 5, passou a Opus 5 durante a maior parte da construção do nível "stretch" (quadros, autenticação, permissões, assistente), e voltou a Sonnet 5 no acabamento final.
- **Subagentes personalizados** (`.claude/agents/*.md`): `product` (só requisitos, só leitura), `dev` (implementação), `security` e `review-qa` (revisões independentes, só reportam, não corrigem).
- **Skill de Claude Design** — usada para desenhar mockups da interface (lista de tarefas, e mais tarde os quadros e o assistente flutuante) antes de escrever o CSS real.
- **MCP servers** — `context7` e `serena` estavam configurados em `.mcp.json` mas nunca ligaram nesta máquina (`CONNECTION_CLOSED`); o `playwright` também não chegou a ligar. O trabalho continuou sem eles: a navegação de código foi feita à mão, e a verificação visual da aplicação usou um contentor Docker descartável com Playwright em vez do MCP.
- **APIs de LLM para o chatbot** — a extensão do chatbot foi construída primeiro contra a API da Claude, testada ao vivo contra a API da Gemini, e por fim assente na API da DeepSeek (SDK `openai` apontado para o endpoint compatível da DeepSeek), a pedido do utilizador. O enunciado não restringe a ferramenta, por isso esta troca foi tratada como normal.

## Exemplos de prompts e resultados

**1. "Let's start the project with docker files"**
Resultado: o Claude Code criou o repositório completo numa só vez — `CLAUDE.md`, `.mcp.json`, os quatro subagentes, um backend Express (routes → controllers → services, SQL parametrizado, migrações numeradas aplicadas no arranque), um frontend React/Vite, e um `docker-compose.yml` com os três serviços. Foi dito claramente que nada disto tinha ainda sido executado, já que o Claude Code não corre Docker/Node no seu próprio ambiente — nada foi apresentado como "a funcionar" sem ter sido testado primeiro.

**2. "Use a mcp for claude design" seguido de um pedido para expandir o projeto para vários quadros, drag-and-drop, autenticação e permissões**
Resultado: a skill de Claude Design foi usada para desenhar um mockup da lista de tarefas, implementado depois em CSS real. Quando o pedido seguinte pediu, a meio da tarefa, para transformar isto num produto muito maior (estilo Trello), isso contradizia o âmbito já definido em `CLAUDE.md` ("o núcleo é inegociável, o resto é aditivo"). Em vez de simplesmente construir, o assistente parou e perguntou se era para o mockup, para âmbito novo, ou para um roadmap futuro. O utilizador escolheu roadmap nessa altura — e mais tarde, já com o núcleo entregue, pediu para de facto construir esse nível "stretch", que acabou implementado por completo (vários quadros, drag-and-drop, contas de utilizador, atribuição de tarefas a várias pessoas, permissões por quadro, e um assistente conversacional capaz de gerir tudo isto).

**3. "floating button on the bottom to use the agent... use the mcps and skill (claude design) available"**
Resultado: o assistente de chat passou de um separador próprio para um botão flutuante disponível em qualquer página, com ferramentas para criar/mover tarefas, colunas e quadros, e para gerir membros. Isto teve uma consequência de segurança que só apareceu numa revisão dedicada (ver abaixo): o assistente chama os serviços diretamente, sem passar pelas rotas Express — por isso as proteções de permissão escritas como middleware do Express não se aplicam a ele, e teve de existir um controlo de acesso próprio e equivalente só para o assistente.

## O que foi aceite tal como gerado vs. corrigido ou rejeitado, e porquê

- **Aceite tal como gerado:** a estrutura geral do projeto (routes → controllers → services), a maior parte do CRUD de tarefas e quadros, e o esquema geral da base de dados.
- **Corrigido, entre outros:** um bug de SQL na criação de tarefas (colunas enum recebiam texto sem conversão explícita); mensagens de erro da base de dados a vazar para o cliente da API; falta de validação de input; um id sequencial usado como token de confirmação de ações destrutivas do chatbot, trocado por um aleatório; um bug de fuso horário que atrasava a data-limite de todas as tarefas em um dia; uma falha de segurança crítica em que o assistente podia ser convencido, por texto escondido no nome de um utilizador, a promover alguém a dono de um quadro (corrigido: essa ação passou a exigir confirmação, o modelo deixou de poder escolher o cargo, e os nomes de utilizador passaram a ter um limite de tamanho); um bug em que o assistente respondia com erro sempre que o fornecedor de IA devolvia mais do que uma chamada de ferramenta na mesma resposta.
- **Rejeitado:** mudar a chave estrangeira entre colunas e tarefas para apagar em cascata de forma mais "simples" — rejeitado porque quebraria a ordem garantida da eliminação de um quadro; manteve-se a proteção feita ao nível do serviço, com bloqueio explícito da tabela.

## Um erro da IA, e como foi detetado

O mais valioso não foi encontrado por um teste, mas por uma conversa real com o próprio utilizador. Ao pedir ao assistente "tarefas pendentes nos quadros", a resposta falhava sempre com um erro genérico. O registo do backend mostrava a causa real: quando o fornecedor de IA devolvia várias chamadas de ferramenta na mesma resposta (uma por cada quadro do utilizador), o código só respondia à primeira, o que tornava o pedido seguinte inválido e derrubava toda a conversa.

Isto escondeu-se bem porque o código foi escrito numa altura em que o assistente só tinha ferramentas de alvo único, onde esse cenário praticamente nunca acontece — só passou a ocorrer quando os quadros deram ao modelo um motivo real para pedir várias coisas de uma vez. Todos os testes escritos até aí chamavam a função das ferramentas diretamente, nunca passando por uma resposta real do fornecedor — por isso nenhum deles podia ter apanhado este bug. A correção veio junto com o teste que devia ter existido desde o início: um cliente de IA substituível por um falso nos testes, devolvendo duas chamadas de ferramenta de propósito, confirmando que ambas recebem resposta. A lição: quando o código conversa com um protocolo externo, os testes têm de simular as formas desse protocolo (respostas em lote, respostas vazias, erros), e não só o lado da função que se controla.

## O que o projeto ganhou depois do exercício base

O núcleo pedido no enunciado é a lista de tarefas simples (`/`). Tudo o resto abaixo foi construído depois, a pedido, e resume-se aqui em poucas linhas — o "como" e o "porquê" de cada peça:

- **Quadros (`/boards`)** — em vez de uma única lista, as tarefas passaram a viver em quadros ao estilo Trello, um por projeto ou equipa.
- **Colunas personalizáveis** — cada quadro tem as suas próprias colunas (por exemplo "A fazer", "Em progresso", "Feito"), que o utilizador cria, renomeia e apaga.
- **Arrastar e largar** — os cartões movem-se entre colunas por drag-and-drop.
- **Contas de utilizador** — registo e login com sessão guardada em cookie, para cada pessoa ter o seu próprio acesso.
- **Permissões por quadro** — cada quadro tem um dono e membros; só o dono convida ou remove pessoas, e só quem pertence ao quadro o vê ou edita.
- **Atribuição de tarefas** — um cartão pode ser atribuído a uma ou várias pessoas do quadro.
- **Detalhe do cartão** — clicar num cartão abre um modal para editar título, descrição, coluna, prioridade e etiquetas de cor.
- **Assistente de chat** — um botão flutuante disponível em qualquer página que entende pedidos em português normal ("cria uma tarefa para amanhã", "que tarefas tenho no quadro X") e executa a ação a sério na base de dados, sempre pedindo confirmação antes de qualquer ação que mude ou apague algo importante.
- **Testes automáticos e integração contínua** — 99 testes no backend e 31 no frontend, corridos automaticamente a cada alteração via GitHub Actions, para apanhar regressões sem depender de testar tudo à mão.

Cada uma destas peças está documentada com mais detalhe (incluindo os bugs encontrados pelo caminho) em [PROJECT-PLAN.md](PROJECT-PLAN.md) e [prompts-file.md](prompts-file.md).

---

Ver [prompts-file.md](prompts-file.md) para o registo completo de prompts usados ao longo do projeto.
