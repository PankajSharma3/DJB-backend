const express = require('express');
const router = express.Router();
const { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } = require('./supplier.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

router.route('/:id')
  .get(getSupplierById)
  .put(updateSupplier)
  .delete(deleteSupplier);

module.exports = router;
