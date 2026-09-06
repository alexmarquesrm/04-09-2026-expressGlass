const express = require('express');
const boardsController = require('../controllers/boards.controller');
const boardTasksController = require('../controllers/boardTasks.controller');

const router = express.Router();

router.get('/', boardsController.index);
router.post('/', boardsController.create);
router.get('/:id', boardsController.show);
router.patch('/:id', boardsController.update);
router.delete('/:id', boardsController.destroy);

router.get('/:boardId/tasks', boardTasksController.index);
router.post('/:boardId/tasks', boardTasksController.create);
router.get('/:boardId/tasks/:id', boardTasksController.show);
router.patch('/:boardId/tasks/:id', boardTasksController.update);
router.delete('/:boardId/tasks/:id', boardTasksController.destroy);

module.exports = router;
