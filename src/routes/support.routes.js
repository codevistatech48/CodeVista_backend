const express = require('express');
const supportController = require('../controllers/support.controller');

const router = express.Router();

router.post('/feedback', supportController.submitFeedback);

module.exports = router;
