const express = require('express');
const router = express.Router();
const { getBookings, createBooking, cancelBooking } = require('./sales.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getBookings)
  .post(createBooking);

router.post('/:id/cancel', cancelBooking);

module.exports = router;
