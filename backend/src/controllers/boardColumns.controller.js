const boardColumnsService = require('../services/boardColumns.service');
const { parseId, validateColumnFields } = require('../utils/validation');

async function index(req, res, next) {
  try {
    res.json(await boardColumnsService.listColumns(req.boardId));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validateColumnFields(req.body, { requireName: true });
    const column = await boardColumnsService.createColumn(req.boardId, req.body);
    res.status(201).json(column);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseId(req.params.columnId, 'column');
    validateColumnFields(req.body, { requireName: false });
    const column = await boardColumnsService.updateColumn(req.boardId, id, req.body);
    if (!column) {
      const err = new Error('column not found');
      err.status = 404;
      throw err;
    }
    res.json(column);
  } catch (err) {
    next(err);
  }
}

const DELETE_ERRORS = {
  not_found: { status: 404, message: 'column not found' },
  last_column: { status: 400, message: 'cannot delete the last column of a board' },
  not_empty: { status: 400, message: 'cannot delete a column that still has tasks' },
};

async function destroy(req, res, next) {
  try {
    const id = parseId(req.params.columnId, 'column');
    const result = await boardColumnsService.deleteColumnSafely(req.boardId, id);
    if (!result.ok) {
      const { status, message } = DELETE_ERRORS[result.reason];
      const err = new Error(message);
      err.status = status;
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, create, update, destroy };
