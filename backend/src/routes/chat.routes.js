const express = require('express');
const controller = require('../controllers/chat.controller');
const requireAuth = require('../middleware/auth.middleware');

const router = express.Router();

// The assistant can now act on boards, which are permission-scoped, so it acts
// as a specific logged-in user rather than anonymously.
router.post('/', requireAuth, controller.sendMessage);
router.post('/confirm', requireAuth, controller.confirmAction);

module.exports = router;
