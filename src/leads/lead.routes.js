const express = require('express');
const router = express.Router();
const { getLeads, createLead, updateLead, addFollowUp } = require('./lead.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getLeads)
  .post(createLead);

router.route('/:id')
  .put(updateLead);

router.post('/:id/followup', addFollowUp);

module.exports = router;
