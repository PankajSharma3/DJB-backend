const express = require('express');
const router = express.Router();
const { getDashboardStats, getGstSalesRegister, getGstPurchaseRegister, getAuditLogs } = require('./reports.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/gst-sales', getGstSalesRegister);
router.get('/gst-purchase', getGstPurchaseRegister);
router.get('/audit', getAuditLogs);

module.exports = router;
