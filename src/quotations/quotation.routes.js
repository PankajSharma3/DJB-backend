const express = require('express');
const router = express.Router();
const { getQuotations, getQuotationById, createQuotation, updateQuotationStatus, deleteQuotation } = require('./quotation.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getQuotations)
  .post(createQuotation);

router.route('/:id')
  .get(getQuotationById)
  .put(updateQuotationStatus)
  .delete(deleteQuotation);

module.exports = router;
