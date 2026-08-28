const express = require('express');
const router = express.Router();
const { getTestDrives, createTestDrive, completeTestDrive } = require('./test_drive.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getTestDrives)
  .post(createTestDrive);

router.put('/:id/complete', completeTestDrive);

module.exports = router;
