const OpenAI = require('openai');
const tasksService = require('./tasks.service');
const auditService = require('./audit.service');
const { parseId, validateTaskFields } = require('../utils/validation');

const MODEL = 'deepseek-v4-flash';

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildSystemPrompt() {
  const now = new Date();
  const today = localDateString(now);
  const weekday = now.toLocaleDateString('pt-PT', { weekday: 'long' });
  return (
    'Es o assistente de tarefas da ExpressGlass. Respondes sempre em portugues, de forma breve e direta. ' +
    'Usa as ferramentas disponiveis para consultar, criar, atualizar ou eliminar tarefas. ' +
    'Nunca inventes ids de tarefas - usa list_tasks para os descobrir primeiro se nao tiveres a certeza. ' +
    'Quando o pedido for para atualizar ou eliminar uma tarefa, chama sempre a ferramenta update_task ou ' +
    'delete_task de imediato assim que souberes o id certo - nunca perguntes tu mesmo se o utilizador tem a ' +
    'certeza em vez de chamar a ferramenta; a aplicacao ja mostra um pedido de confirmacao proprio depois de ' +
    'chamares a ferramenta, antes de a acao ser realmente executada. ' +
    `A data de hoje e ${today} (${weekday}). Quando o pedido usar datas relativas (amanha, a semana que ` +
    'vem, sexta-feira, daqui a X dias, etc.), calcula tu mesmo a data real a partir de hoje e passa-a a ' +
    'due_date no formato YYYY-MM-DD - nunca deixes essa conta por fazer nem inventes uma data sem calcular.'
  );
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List tasks, optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          filter: { type: 'string', enum: ['pending', 'completed'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          due_date: { type: 'string', description: 'ISO date, YYYY-MM-DD' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task by id. Destructive: requires user confirmation before it is applied.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'completed'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task by id. Destructive: requires user confirmation before it is applied.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
  },
];

const DESTRUCTIVE_TOOLS = new Set(['update_task', 'delete_task']);

const FIELD_LABELS = {
  title: 'titulo',
  description: 'descricao',
  status: 'estado',
  priority: 'prioridade',
  due_date: 'data limite',
  tags: 'etiquetas',
};

function getClient() {
  if (!process.env.DEEPSEEK_API_KEY) {
    const err = new Error('O assistente de chat nao esta configurado (falta DEEPSEEK_API_KEY).');
    err.status = 503;
    throw err;
  }
  return new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
}

async function callDeepSeek(client, params) {
  try {
    return await client.chat.completions.create(params);
  } catch (err) {
    console.error('DeepSeek API call failed:', err);
    if (err.status === 429) {
      const wrapped = new Error(
        'O assistente atingiu o limite de pedidos a API do DeepSeek por agora. Tenta novamente mais tarde.'
      );
      wrapped.status = 429;
      throw wrapped;
    }
    if (err.status === 401) {
      const wrapped = new Error('O assistente de chat nao esta configurado corretamente (chave da API invalida).');
      wrapped.status = 503;
      throw wrapped;
    }
    const wrapped = new Error('Nao foi possivel falar com o assistente de momento. Tenta novamente.');
    wrapped.status = 502;
    throw wrapped;
  }
}

async function executeTool(name, args) {
  switch (name) {
    case 'list_tasks':
      return tasksService.listTasks(args.filter);
    case 'create_task':
      validateTaskFields(args, { requireTitle: true });
      return tasksService.createTask(args);
    case 'update_task': {
      const { id, ...fields } = args;
      const validId = parseId(id);
      validateTaskFields(fields, { requireTitle: false });
      return tasksService.updateTask(validId, fields);
    }
    case 'delete_task': {
      const validId = parseId(args.id);
      const deleted = await tasksService.deleteTask(validId);
      return { deleted };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '(vazio)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(vazio)';
  return String(value);
}

function describeChanges(task, input) {
  return Object.keys(input)
    .filter((key) => key !== 'id')
    .map((key) => `${FIELD_LABELS[key] || key}: "${formatValue(task[key])}" -> "${formatValue(input[key])}"`);
}

async function handlePendingConfirmation(message, call) {
  let id;
  try {
    id = parseId(call.args.id);
  } catch {
    return { reply: 'O id da tarefa indicado nao e valido.', actions_taken: [] };
  }

  const task = await tasksService.getTask(id);
  if (!task) {
    return { reply: `Nao encontrei nenhuma tarefa com o id ${id}.`, actions_taken: [] };
  }

  if (call.name === 'update_task') {
    const { id: _drop, ...fields } = call.args;
    try {
      validateTaskFields(fields, { requireTitle: false });
    } catch (err) {
      return { reply: `Nao consigo aplicar essa atualizacao: ${err.message}`, actions_taken: [] };
    }
  }

  const verb = call.name === 'delete_task' ? 'eliminar' : 'atualizar';
  const summary = `${verb} a tarefa "${task.title}" (#${task.id})`;
  const changes = call.name === 'update_task' ? describeChanges(task, call.args) : [];
  const detail = changes.length ? `\n${changes.join('\n')}` : '';

  const auditRow = await auditService.logPendingToolCall({ message, tool: call.name, args: call.args });

  return {
    reply: `Queres mesmo ${summary}?${detail}\n\nConfirma para eu avancar.`,
    actions_taken: [],
    requires_confirmation: {
      confirmation_token: auditRow.confirmation_token,
      tool: call.name,
      args: call.args,
      summary,
    },
  };
}

// Some providers look a task up (list_tasks) before proposing a destructive
// change to it, so one user message can need more than one tool call in a row
// (e.g. "apaga a tarefa 9" -> list_tasks to double-check, then delete_task).
// Bounded so a confused model can't turn one message into unbounded paid calls.
const MAX_TOOL_HOPS = 4;

async function handleMessage(message) {
  const client = getClient();
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: message },
  ];
  const actionsTaken = [];

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const completion = await callDeepSeek(client, {
      model: MODEL,
      messages,
      tools: TOOLS,
    });

    const responseMessage = completion.choices[0].message;
    const toolCall = responseMessage.tool_calls && responseMessage.tool_calls[0];

    if (!toolCall) {
      return { reply: responseMessage.content || '', actions_taken: actionsTaken };
    }

    const call = {
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments || '{}'),
      id: toolCall.id,
    };

    if (DESTRUCTIVE_TOOLS.has(call.name)) {
      const pending = await handlePendingConfirmation(message, call);
      return { ...pending, actions_taken: [...actionsTaken, ...pending.actions_taken] };
    }

    const result = await executeTool(call.name, call.args);
    await auditService.logToolCall({ message, tool: call.name, args: call.args, result });
    actionsTaken.push({ tool: call.name, args: call.args, result });

    messages.push(responseMessage);
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
  }

  return { reply: 'Nao consegui concluir o pedido - tenta ser mais especifico.', actions_taken: actionsTaken };
}

async function confirmAction(confirmationToken, confirmed) {
  const row = await auditService.getPending(confirmationToken);
  if (!row) {
    const err = new Error('Pedido de confirmacao nao encontrado ou ja resolvido.');
    err.status = 404;
    throw err;
  }

  if (!confirmed) {
    await auditService.resolve(confirmationToken, { status: 'cancelled' });
    return { reply: 'Ok, nao fiz nada.', actions_taken: [] };
  }

  const result = await executeTool(row.tool_called, row.tool_args);
  await auditService.resolve(confirmationToken, result);

  const notFound = result === null || result.deleted === false;
  if (notFound) {
    return {
      reply: 'Essa tarefa ja nao existe - nao fiz nenhuma alteracao.',
      actions_taken: [{ tool: row.tool_called, args: row.tool_args, result }],
    };
  }

  const verb = row.tool_called === 'delete_task' ? 'eliminada' : 'atualizada';
  return {
    reply: `Tarefa ${verb} com sucesso.`,
    actions_taken: [{ tool: row.tool_called, args: row.tool_args, result }],
  };
}

module.exports = { handleMessage, confirmAction };
