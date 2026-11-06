const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('./company.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getSettings);
router.put('/', protect, authorize('admin'), updateSettings);

module.exports = router;
