const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const agentTools = require('../src/services/agentTools.service');
const boardsService = require('../src/services/boards.service');
const boardColumnsService = require('../src/services/boardColumns.service');
const boardTasksService = require('../src/services/boardTasks.service');
const boardMembersService = require('../src/services/boardMembers.service');
const auditService = require('../src/services/audit.service');
const llmService = require('../src/services/llm.service');
const authService = require('../src/services/auth.service');

function uniqueEmail() {
  return `agenttest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

let owner;
let stranger;
let board;

test.before(async () => {
  owner = await authService.createUser({ name: 'Agent Owner', email: uniqueEmail(), password: 'supersecret' });
  stranger = await authService.createUser({ name: 'Agent Stranger', email: uniqueEmail(), password: 'supersecret' });
  board = await boardsService.createBoard({ name: 'Agent board' }, owner.id);
});

test('every board-scoped tool refuses a user who is not a member of that board', async () => {
  const columns = await boardColumnsService.listColumns(board.id);
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Owner only' });

  const calls = [
    ['list_board_tasks', { board_id: board.id }],
    ['list_board_columns', { board_id: board.id }],
    ['list_board_members', { board_id: board.id }],
    ['create_board_task', { board_id: board.id, title: 'sneaky' }],
    ['create_board_column', { board_id: board.id, name: 'sneaky' }],
    ['update_board_task', { board_id: board.id, id: task.id, title: 'sneaky' }],
    ['delete_board_task', { board_id: board.id, id: task.id }],
    ['add_board_member', { board_id: board.id, user_id: stranger.id }],
  ];

  for (const [name, args] of calls) {
    await assert.rejects(
      () => agentTools.executeTool(name, args, stranger),
      (err) => err.status === 403,
      `${name} should refuse a non-member`
    );
  }

  // and nothing was actually changed by any of those attempts
  const tasks = await boardTasksService.listBoardTasks(board.id);
  assert.strictEqual(tasks.length, 1);
  assert.strictEqual(tasks[0].title, 'Owner only');
  assert.strictEqual((await boardColumnsService.listColumns(board.id)).length, columns.length);
  assert.strictEqual((await boardMembersService.listMembers(board.id)).length, 1);

  await boardTasksService.deleteBoardTask(board.id, task.id);
});

test('a plain member is refused owner-only tools but allowed member-level ones', async () => {
  await boardMembersService.addMember(board.id, stranger.id, 'member');

  const created = await agentTools.executeTool('create_board_task', { board_id: board.id, title: 'Member made this' }, stranger);
  assert.strictEqual(created.title, 'Member made this');

  await assert.rejects(
    () => agentTools.executeTool('add_board_member', { board_id: board.id, user_id: stranger.id, role: 'owner' }, stranger),
    (err) => err.status === 403
  );

  await boardTasksService.deleteBoardTask(board.id, created.id);
  await boardMembersService.removeMember(board.id, stranger.id);
});

test('a board that does not exist is a 404, not a 403 that leaks nothing useful', async () => {
  await assert.rejects(
    () => agentTools.executeTool('list_board_tasks', { board_id: 99999999 }, owner),
    (err) => err.status === 404
  );
});

test('list_boards only returns the caller\'s own boards', async () => {
  const ownerBoards = await agentTools.executeTool('list_boards', {}, owner);
  assert.ok(ownerBoards.some((b) => b.id === board.id));

  const strangerBoards = await agentTools.executeTool('list_boards', {}, stranger);
  assert.ok(!strangerBoards.some((b) => b.id === board.id));
});

test('a board created through the assistant belongs to the caller and has default columns', async () => {
  const created = await agentTools.executeTool('create_board', { name: 'Made by the assistant' }, stranger);

  const membership = await boardMembersService.getMembership(created.id, stranger.id);
  assert.strictEqual(membership.role, 'owner');
  assert.strictEqual((await boardColumnsService.listColumns(created.id)).length, 3);

  await boardsService.deleteBoard(created.id);
});

test('adding a board member is gated behind confirmation, and can never grant ownership', async () => {
  // The security-critical property: the assistant must not be able to hand out
  // board access on its own, and must not be able to hand out ownership at all.
  assert.ok(agentTools.DESTRUCTIVE_TOOLS.has('add_board_member'));

  const schema = agentTools.TOOLS.find((t) => t.function.name === 'add_board_member');
  assert.ok(!('role' in schema.function.parameters.properties), 'add_board_member must not expose a role');

  // even if a role is smuggled into the args, execution forces 'member'
  await agentTools.executeTool('add_board_member', { board_id: board.id, user_id: stranger.id, role: 'owner' }, owner);
  const membership = await boardMembersService.getMembership(board.id, stranger.id);
  assert.strictEqual(membership.role, 'member');

  await boardMembersService.removeMember(board.id, stranger.id);
});

test('the 403 for a board you cannot see does not disclose its name', async () => {
  const secret = await boardsService.createBoard({ name: 'Totally Secret Roadmap' }, owner.id);
  await assert.rejects(
    () => agentTools.executeTool('list_board_tasks', { board_id: secret.id }, stranger),
    (err) => err.status === 403 && !err.message.includes('Totally Secret Roadmap')
  );
  await boardsService.deleteBoard(secret.id);
});

test('the assistant cannot assign a card to someone who is not on the board', async () => {
  await assert.rejects(
    () => agentTools.executeTool('create_board_task', { board_id: board.id, title: 'Bad assignee', assignee_id: stranger.id }, owner),
    /must be a member of this board/
  );
});

test('a card moved to another column without an explicit position goes to the end, not on top of another card', async () => {
  const columns = await boardColumnsService.listColumns(board.id);
  const first = await boardTasksService.createBoardTask(board.id, { title: 'First', column_id: columns[1].id });
  const second = await boardTasksService.createBoardTask(board.id, { title: 'Second', column_id: columns[0].id });

  const moved = await boardTasksService.updateBoardTask(board.id, second.id, { column_id: columns[1].id });
  assert.notStrictEqual(moved.position, first.position, 'a moved card must not land on an occupied position');
  assert.ok(moved.position > first.position);

  await boardTasksService.deleteBoardTask(board.id, first.id);
  await boardTasksService.deleteBoardTask(board.id, second.id);
});

test('an explicit column_id of null is rejected rather than silently relocating the card', async () => {
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Null column' });
  await assert.rejects(
    () => agentTools.executeTool('update_board_task', { board_id: board.id, id: task.id, column_id: null }, owner),
    /column_id must be a positive integer/
  );
  await boardTasksService.deleteBoardTask(board.id, task.id);
});

test('a pending confirmation can only be confirmed by the user who proposed it, and only once', async () => {
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Confirm me' });
  await boardMembersService.addMember(board.id, stranger.id, 'member');

  const pending = await auditService.logPendingToolCall({
    message: 'apaga o cartão',
    tool: 'delete_board_task',
    args: { board_id: board.id, id: task.id },
    userId: owner.id,
  });

  // another user holding the token cannot confirm it, even though they are
  // themselves a member of the board
  await assert.rejects(
    () => llmService.confirmAction(pending.confirmation_token, true, stranger),
    (err) => err.status === 404
  );
  assert.ok(await boardTasksService.getBoardTask(board.id, task.id), 'the card must still exist');

  // the proposer can, exactly once
  const done = await llmService.confirmAction(pending.confirmation_token, true, owner);
  assert.match(done.reply, /eliminado/);
  assert.strictEqual(await boardTasksService.getBoardTask(board.id, task.id), null);

  await assert.rejects(
    () => llmService.confirmAction(pending.confirmation_token, true, owner),
    (err) => err.status === 404,
    'a token must not be replayable'
  );

  await boardMembersService.removeMember(board.id, stranger.id);
});

test('a pending confirmation with no recorded user is not confirmable by anyone', async () => {
  const task = await boardTasksService.createBoardTask(board.id, { title: 'Orphan pending' });
  const pending = await auditService.logPendingToolCall({
    message: 'apaga',
    tool: 'delete_board_task',
    args: { board_id: board.id, id: task.id },
    userId: null,
  });

  await assert.rejects(
    () => llmService.confirmAction(pending.confirmation_token, true, owner),
    (err) => err.status === 404
  );
  assert.ok(await boardTasksService.getBoardTask(board.id, task.id));

  await boardTasksService.deleteBoardTask(board.id, task.id);
});

test('a response with several tool calls answers every one of them', async () => {
  // The provider batches calls (one per board, say). Replying to only the first
  // makes the next request malformed and the API rejects the whole turn with
  // "An assistant message with 'tool_calls' must be followed by tool messages
  // responding to each 'tool_call_id'" - which is exactly what happened live.
  const requests = [];
  const responses = [
    {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'call_1', type: 'function', function: { name: 'list_boards', arguments: '{}' } },
              { id: 'call_2', type: 'function', function: { name: 'list_my_board_tasks', arguments: '{}' } },
            ],
          },
        },
      ],
    },
    { choices: [{ message: { role: 'assistant', content: 'Aqui está.' } }] },
  ];
  const client = {
    chat: {
      completions: {
        create: async (params) => {
          requests.push(params.messages);
          return responses.shift();
        },
      },
    },
  };

  const result = await llmService.handleMessage('tarefas pendentes nos quadros', owner, client);
  assert.strictEqual(result.reply, 'Aqui está.');
  assert.strictEqual(result.actions_taken.length, 2, 'both tool calls should run');

  const secondRequest = requests[1];
  const toolMessages = secondRequest.filter((m) => m.role === 'tool');
  assert.deepStrictEqual(
    toolMessages.map((m) => m.tool_call_id).sort(),
    ['call_1', 'call_2'],
    'every tool_call_id must be answered'
  );
});

test('list_my_board_tasks returns only cards assigned to the caller, across boards, with board and column names', async () => {
  const second = await boardsService.createBoard({ name: 'Agent second board' }, owner.id);
  await boardMembersService.addMember(board.id, stranger.id, 'member');

  const mineHere = await boardTasksService.createBoardTask(board.id, { title: 'Meu cartao A', assignee_id: owner.id });
  const mineThere = await boardTasksService.createBoardTask(second.id, { title: 'Meu cartao B', assignee_id: owner.id });
  await boardTasksService.createBoardTask(board.id, { title: 'Do outro', assignee_id: stranger.id });
  await boardTasksService.createBoardTask(board.id, { title: 'De ninguem' });

  const mine = await agentTools.executeTool('list_my_board_tasks', {}, owner);
  const titles = mine.map((t) => t.title).sort();
  assert.deepStrictEqual(titles, ['Meu cartao A', 'Meu cartao B']);
  assert.ok(mine.every((t) => t.board_name && t.column_name), 'each card names its board and column');

  const theirs = await agentTools.executeTool('list_my_board_tasks', {}, stranger);
  assert.deepStrictEqual(theirs.map((t) => t.title), ['Do outro']);

  // losing access to a board hides its cards, even though the assignment remains
  await boardMembersService.removeMember(board.id, stranger.id);
  assert.deepStrictEqual(await agentTools.executeTool('list_my_board_tasks', {}, stranger), []);

  await boardTasksService.deleteBoardTask(board.id, mineHere.id);
  await boardTasksService.deleteBoardTask(second.id, mineThere.id);
  await boardsService.deleteBoard(second.id);
  const leftovers = await boardTasksService.listBoardTasks(board.id);
  for (const t of leftovers) await boardTasksService.deleteBoardTask(board.id, t.id);
});

test.after(async () => {
  await boardsService.deleteBoard(board.id);
  await pool.query("DELETE FROM audit_log WHERE message IN ('apaga o cartão', 'apaga')");
  await pool.query("DELETE FROM users WHERE email LIKE 'agenttest-%@example.com'");
  await pool.end();
});
