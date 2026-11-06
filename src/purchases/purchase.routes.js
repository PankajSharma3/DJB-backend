const express = require('express');
const router = express.Router();
const { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase } = require('./purchase.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPurchases)
  .post(createPurchase);

router.route('/:id')
  .get(getPurchaseById)
  .put(updatePurchase)
  .delete(authorize('admin'), deletePurchase);

module.exports = router;
