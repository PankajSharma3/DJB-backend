const express = require('express');
const router = express.Router();
const { getExpenses, createExpense } = require('./expense.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(createExpense);

module.exports = router;
