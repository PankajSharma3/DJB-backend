const express = require('express');
const router = express.Router();
const { 
  getJobCards, 
  getJobCardById, 
  createJobCard, 
  updateJobCard, 
  deleteJobCard, 
  generateInvoiceFromService 
} = require('./service.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getJobCards)
  .post(createJobCard);

router.route('/:id')
  .get(getJobCardById)
  .put(updateJobCard)
  .delete(deleteJobCard);

router.post('/:id/generate-invoice', generateInvoiceFromService);

module.exports = router;
