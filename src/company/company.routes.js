const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('./company.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
