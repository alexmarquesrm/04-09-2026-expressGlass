const express = require('express');
const controller = require('../controllers/chat.controller');

const router = express.Router();

router.post('/', controller.sendMessage);
router.post('/confirm', controller.confirmAction);

module.exports = router;
