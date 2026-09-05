const Anthropic = require('@anthropic-ai/sdk');
const tasksService = require('./tasks.service');
const auditService = require('./audit.service');
const { parseId, validateTaskFields } = require('../utils/validation');

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT =
  'Es o assistente de tarefas da ExpressGlass. Respondes sempre em portugues, de forma breve e direta. ' +
  'Usa as ferramentas disponiveis para consultar, criar, atualizar ou eliminar tarefas. ' +
  'Nunca inventes ids de tarefas - usa list_tasks para os descobrir primeiro se nao tiveres a certeza.';

const TOOLS = [
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status.',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['pending', 'completed'] },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task.',
    input_schema: {
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
  {
    name: 'update_task',
    description: 'Update an existing task by id. Destructive: requires user confirmation before it is applied.',
    input_schema: {
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
  {
    name: 'delete_task',
    description: 'Delete a task by id. Destructive: requires user confirmation before it is applied.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
      },
      required: ['id'],
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
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('O assistente de chat nao esta configurado (falta ANTHROPIC_API_KEY).');
    err.status = 503;
    throw err;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function callClaude(client, params) {
  try {
    return await client.messages.create(params);
  } catch (err) {
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

function textFrom(response) {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
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

async function handlePendingConfirmation(message, toolUse) {
  let id;
  try {
    id = parseId(toolUse.input.id);
  } catch {
    return { reply: 'O id da tarefa indicado nao e valido.', actions_taken: [] };
  }

  const task = await tasksService.getTask(id);
  if (!task) {
    return { reply: `Nao encontrei nenhuma tarefa com o id ${id}.`, actions_taken: [] };
  }

  if (toolUse.name === 'update_task') {
    const { id: _drop, ...fields } = toolUse.input;
    try {
      validateTaskFields(fields, { requireTitle: false });
    } catch (err) {
      return { reply: `Nao consigo aplicar essa atualizacao: ${err.message}`, actions_taken: [] };
    }
  }

  const verb = toolUse.name === 'delete_task' ? 'eliminar' : 'atualizar';
  const summary = `${verb} a tarefa "${task.title}" (#${task.id})`;
  const changes = toolUse.name === 'update_task' ? describeChanges(task, toolUse.input) : [];
  const detail = changes.length ? `\n${changes.join('\n')}` : '';

  const auditRow = await auditService.logPendingToolCall({ message, tool: toolUse.name, args: toolUse.input });

  return {
    reply: `Queres mesmo ${summary}?${detail}\n\nConfirma para eu avancar.`,
    actions_taken: [],
    requires_confirmation: {
      confirmation_token: auditRow.confirmation_token,
      tool: toolUse.name,
      args: toolUse.input,
      summary,
    },
  };
}

async function handleImmediateTool(client, message, toolUse, firstResponse) {
  const result = await executeTool(toolUse.name, toolUse.input);
  await auditService.logToolCall({ message, tool: toolUse.name, args: toolUse.input, result });

  const followUp = await callClaude(client, {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: [
      { role: 'user', content: message },
      { role: 'assistant', content: firstResponse.content },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) }],
      },
    ],
  });

  return {
    reply: textFrom(followUp),
    actions_taken: [{ tool: toolUse.name, args: toolUse.input, result }],
  };
}

async function handleMessage(message) {
  const client = getClient();
  const response = await callClaude(client, {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: [{ role: 'user', content: message }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');

  if (!toolUse) {
    return { reply: textFrom(response), actions_taken: [] };
  }

  if (DESTRUCTIVE_TOOLS.has(toolUse.name)) {
    return handlePendingConfirmation(message, toolUse);
  }

  return handleImmediateTool(client, message, toolUse, response);
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
