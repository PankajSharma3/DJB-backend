const express = require('express');
const router = express.Router();
const { 
  getInvoices, 
  getInvoiceById, 
  createInvoice, 
  cancelInvoice, 
  updateInvoice, 
  deleteInvoice 
} = require('./invoice.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:id')
  .get(getInvoiceById)
  .put(updateInvoice)
  .delete(authorize('admin'), deleteInvoice);

router.post('/:id/cancel', authorize('admin'), cancelInvoice);

module.exports = router;
