const express = require('express');
const controller = require('../controllers/tasks.controller');

const router = express.Router();

router.get('/', controller.index);
router.post('/', controller.create);
router.get('/:id', controller.show);
router.patch('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;
