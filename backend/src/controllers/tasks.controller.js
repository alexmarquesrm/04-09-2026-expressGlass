const tasksService = require('../services/tasks.service');

async function index(req, res, next) {
  try {
    const tasks = await tasksService.listTasks(req.query.filter);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      const err = new Error('title is required');
      err.status = 400;
      throw err;
    }
    const task = await tasksService.createTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const task = await tasksService.getTask(req.params.id);
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
    const task = await tasksService.updateTask(req.params.id, req.body);
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
    const deleted = await tasksService.deleteTask(req.params.id);
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
