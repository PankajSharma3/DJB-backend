const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    default: 'System'
  },
  action: {
    type: String,
    required: true // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'PAYMENT', 'STOCK_RECEIPT'
  },
  entity: {
    type: String,
    required: true // 'Vehicle', 'Invoice', 'Payment', 'Customer', etc.
  },
  entityId: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    default: ''
  },
  beforeData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  afterData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
