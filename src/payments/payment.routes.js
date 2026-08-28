const express = require('express');
const router = express.Router();
const { getPayments, createPayment } = require('./payment.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPayments)
  .post(createPayment);

module.exports = router;
