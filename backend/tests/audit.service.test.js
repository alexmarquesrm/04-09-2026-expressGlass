const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/db/pool');
const auditService = require('../src/services/audit.service');

const createdIds = [];

async function trackedPending(args) {
  const row = await auditService.logPendingToolCall(args);
  createdIds.push(row.id);
  return row;
}

test('logPendingToolCall writes a row with a null result and a confirmation token', async () => {
  const row = await trackedPending({
    message: 'apaga a tarefa 1',
    tool: 'delete_task',
    args: { id: 1 },
  });
  assert.strictEqual(row.tool_called, 'delete_task');
  assert.deepStrictEqual(row.tool_args, { id: 1 });
  assert.strictEqual(row.result, null);
  assert.strictEqual(typeof row.confirmation_token, 'string');
  assert.ok(row.confirmation_token.length > 0);

  const pending = await auditService.getPending(row.confirmation_token);
  assert.strictEqual(pending.id, row.id);
});

test('resolve fills in the result and getPending no longer returns it', async () => {
  const row = await trackedPending({
    message: 'atualiza a tarefa 2',
    tool: 'update_task',
    args: { id: 2, status: 'completed' },
  });

  await auditService.resolve(row.confirmation_token, { status: 'cancelled' });

  const stillPending = await auditService.getPending(row.confirmation_token);
  assert.strictEqual(stillPending, null);
});

test('getPending returns null for an already-cancelled token (cannot be confirmed twice)', async () => {
  const row = await trackedPending({
    message: 'apaga a tarefa 3',
    tool: 'delete_task',
    args: { id: 3 },
  });

  await auditService.resolve(row.confirmation_token, { status: 'cancelled' });
  assert.strictEqual(await auditService.getPending(row.confirmation_token), null);

  await auditService.resolve(row.confirmation_token, { deleted: true });
  assert.strictEqual(await auditService.getPending(row.confirmation_token), null);
});

test('logToolCall writes a row with the result already filled in and no confirmation token', async () => {
  const row = await auditService.logToolCall({
    message: 'lista as tarefas',
    tool: 'list_tasks',
    args: {},
    result: [{ id: 1 }],
  });
  createdIds.push(row.id);
  assert.deepStrictEqual(row.result, [{ id: 1 }]);
  assert.strictEqual(row.confirmation_token, null);
});

test.after(async () => {
  if (createdIds.length > 0) {
    await pool.query('DELETE FROM audit_log WHERE id = ANY($1)', [createdIds]);
  }
  await pool.end();
});
