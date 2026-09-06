const tasksService = require('./tasks.service');
const boardsService = require('./boards.service');
const boardTasksService = require('./boardTasks.service');
const boardColumnsService = require('./boardColumns.service');
const boardMembersService = require('./boardMembers.service');
const usersService = require('./users.service');
const { parseId, validateTaskFields, validateBoardFields, validateColumnFields } = require('../utils/validation');

// The assistant acts as the logged-in user, so every board-scoped tool goes
// through the same membership rules the REST routes enforce. Without this the
// chat endpoint would be a way around S5's board permissions entirely.
async function assertBoardAccess(userId, boardId, { requireOwner = false } = {}) {
  const board = await boardsService.getBoard(boardId);
  if (!board) {
    const err = new Error(`não encontrei nenhum quadro com o id ${boardId}`);
    err.status = 404;
    throw err;
  }

  // Deliberately does not name the board: this message is relayed back to the
  // caller, so naming it would let anyone enumerate every private board's name
  // by walking ids through the chat. Matches boardAccess.middleware's wording.
  const membership = await boardMembersService.getMembership(boardId, userId);
  if (!membership) {
    const err = new Error('não tens acesso a esse quadro');
    err.status = 403;
    throw err;
  }
  if (requireOwner && membership.role !== 'owner') {
    const err = new Error('só o dono do quadro pode fazer isso');
    err.status = 403;
    throw err;
  }

  return { board, membership };
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List the personal (non-board) tasks, optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: { filter: { type: 'string', enum: ['pending', 'completed'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a personal (non-board) task.',
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
      description: 'Update a personal task by id. Destructive: requires user confirmation before it is applied.',
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
      description: 'Delete a personal task by id. Destructive: requires user confirmation before it is applied.',
      parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_boards',
      description: 'List the boards the current user belongs to, with their role on each.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_board',
      description: 'Create a new board owned by the current user. It starts with three default columns.',
      parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_board_columns',
      description: 'List the columns of a board, in order.',
      parameters: { type: 'object', properties: { board_id: { type: 'integer' } }, required: ['board_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_board_column',
      description: 'Add a new column to a board.',
      parameters: {
        type: 'object',
        properties: { board_id: { type: 'integer' }, name: { type: 'string' } },
        required: ['board_id', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_board_tasks',
      description:
        'List the cards on a board. Each card carries column_id/column_name (where it is on the board) and an assignees array of {user_id, name}.',
      parameters: { type: 'object', properties: { board_id: { type: 'integer' } }, required: ['board_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_board_tasks',
      description:
        "Every card assigned to the current user, across all their boards, with board_name and column_name. Use this for questions like \"what am I working on\" or \"my tasks on the boards\" - it answers in one call instead of listing each board separately.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_board_task',
      description:
        'Create a card on a board. Goes in the first column unless column_id is given. Every id in assignee_ids must be a member of the board.',
      parameters: {
        type: 'object',
        properties: {
          board_id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          column_id: { type: 'integer' },
          assignee_ids: { type: 'array', items: { type: 'integer' }, description: 'Board member ids to put on the card; replaces the current set.' },
          due_date: { type: 'string', description: 'ISO date, YYYY-MM-DD' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['board_id', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_board_task',
      description:
        'Update a card on a board - including moving it to another column (column_id) or setting who is on it (assignee_ids, which REPLACES the current set). Destructive: requires user confirmation before it is applied.',
      parameters: {
        type: 'object',
        properties: {
          board_id: { type: 'integer' },
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          column_id: { type: 'integer', description: 'Move the card to this column of the same board.' },
          assignee_ids: { type: 'array', items: { type: 'integer' }, description: 'Board member ids to put on the card; replaces the current set.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date: { type: 'string' },
        },
        required: ['board_id', 'id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_board_task',
      description: 'Delete a card from a board. Destructive: requires user confirmation before it is applied.',
      parameters: {
        type: 'object',
        properties: { board_id: { type: 'integer' }, id: { type: 'integer' } },
        required: ['board_id', 'id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_board_members',
      description: 'List the members of a board and their roles - use this to find the id of the person to assign work to.',
      parameters: { type: 'object', properties: { board_id: { type: 'integer' } }, required: ['board_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_board_member',
      description:
        'Add a registered user to a board as a plain member. Only the board owner can do this, and it requires user confirmation before it is applied.',
      parameters: {
        type: 'object',
        properties: {
          board_id: { type: 'integer' },
          user_id: { type: 'integer' },
        },
        required: ['board_id', 'user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_users',
      description: 'List registered users (id and name) - use this to find the id of someone to add to a board.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// Anything that changes existing state, or hands someone access to a board,
// goes through the confirm-then-execute flow. add_board_member is in here
// because granting access is exactly the kind of thing the assistant must not
// do off its own bat - the model sees user-authored text (names, card titles)
// and could be talked into it.
const DESTRUCTIVE_TOOLS = new Set([
  'update_task',
  'delete_task',
  'update_board_task',
  'delete_board_task',
  'add_board_member',
]);

async function executeTool(name, args, user) {
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
      return { deleted: await tasksService.deleteTask(validId) };
    }

    case 'list_boards':
      return boardMembersService.listBoardsForUser(user.id);
    case 'create_board': {
      validateBoardFields(args, { requireName: true });
      return boardsService.createBoard({ name: args.name }, user.id);
    }

    case 'list_board_columns': {
      const boardId = parseId(args.board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      return boardColumnsService.listColumns(boardId);
    }
    case 'create_board_column': {
      const boardId = parseId(args.board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      validateColumnFields(args, { requireName: true });
      return boardColumnsService.createColumn(boardId, { name: args.name });
    }

    case 'list_board_tasks': {
      const boardId = parseId(args.board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      return boardTasksService.listBoardTasks(boardId);
    }
    case 'list_my_board_tasks':
      // Already scoped to this user by the query itself, so no board gate here.
      return boardTasksService.listTasksAssignedTo(user.id);

    case 'create_board_task': {
      const { board_id, ...fields } = args;
      const boardId = parseId(board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      validateTaskFields(fields, { requireTitle: true });
      return boardTasksService.createBoardTask(boardId, fields);
    }
    case 'update_board_task': {
      const { board_id, id, ...fields } = args;
      const boardId = parseId(board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      validateTaskFields(fields, { requireTitle: false });
      return boardTasksService.updateBoardTask(boardId, parseId(id), fields);
    }
    case 'delete_board_task': {
      const boardId = parseId(args.board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      return { deleted: await boardTasksService.deleteBoardTask(boardId, parseId(args.id)) };
    }

    case 'list_board_members': {
      const boardId = parseId(args.board_id, 'board');
      await assertBoardAccess(user.id, boardId);
      return boardMembersService.listMembers(boardId);
    }
    case 'add_board_member': {
      const boardId = parseId(args.board_id, 'board');
      await assertBoardAccess(user.id, boardId, { requireOwner: true });
      const userId = parseId(args.user_id, 'user');
      // Always 'member': the assistant can never hand out ownership, whatever
      // the model was persuaded to pass.
      const result = await boardMembersService.upsertMemberRoleSafely(boardId, userId, 'member');
      if (!result.ok) {
        const err = new Error('não posso despromover o único dono do quadro');
        err.status = 400;
        throw err;
      }
      return result.member;
    }

    case 'list_users':
      return usersService.listUsers();

    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

module.exports = { TOOLS, DESTRUCTIVE_TOOLS, executeTool, assertBoardAccess };
