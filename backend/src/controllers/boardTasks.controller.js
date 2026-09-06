const boardTasksService = require('../services/boardTasks.service');
const { parseId, validateTaskFields } = require('../utils/validation');

async function index(req, res, next) {
  try {
    const tasks = await boardTasksService.listBoardTasks(req.boardId);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    validateTaskFields(req.body, { requireTitle: true });
    const task = await boardTasksService.createBoardTask(req.boardId, req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const task = await boardTasksService.getBoardTask(req.boardId, id);
    if (!task) {
      const err = new Error('task not found');
      err.status = 404;
      throw err;
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseId(req.params.id);
    validateTaskFields(req.body, { requireTitle: false });
    const task = await boardTasksService.updateBoardTask(req.boardId, id, req.body);
    if (!task) {
      const err = new Error('task not found');
      err.status = 404;
      throw err;
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const deleted = await boardTasksService.deleteBoardTask(req.boardId, id);
    if (!deleted) {
      const err = new Error('task not found');
      err.status = 404;
      throw err;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { index, create, show, update, destroy };
