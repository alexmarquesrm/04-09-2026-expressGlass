const express = require('express');
const boardsController = require('../controllers/boards.controller');
const boardTasksController = require('../controllers/boardTasks.controller');
const boardMembersController = require('../controllers/boardMembers.controller');
const requireAuth = require('../middleware/auth.middleware');
const { requireBoardMember, requireBoardOwner } = require('../middleware/boardAccess.middleware');

const router = express.Router();

router.get('/', requireAuth, boardsController.index);
router.post('/', requireAuth, boardsController.create);
router.get('/:id', requireAuth, requireBoardMember, boardsController.show);
router.patch('/:id', requireAuth, requireBoardOwner, boardsController.update);
router.delete('/:id', requireAuth, requireBoardOwner, boardsController.destroy);

router.get('/:id/members', requireAuth, requireBoardMember, boardMembersController.index);
router.post('/:id/members', requireAuth, requireBoardOwner, boardMembersController.create);
router.delete('/:id/members/:userId', requireAuth, requireBoardOwner, boardMembersController.destroy);

router.get('/:boardId/tasks', requireAuth, requireBoardMember, boardTasksController.index);
router.post('/:boardId/tasks', requireAuth, requireBoardMember, boardTasksController.create);
router.get('/:boardId/tasks/:id', requireAuth, requireBoardMember, boardTasksController.show);
router.patch('/:boardId/tasks/:id', requireAuth, requireBoardMember, boardTasksController.update);
router.delete('/:boardId/tasks/:id', requireAuth, requireBoardMember, boardTasksController.destroy);

module.exports = router;
