const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['Receipt', 'Payment'],
    required: true
  },
  partyType: {
    type: String,
    enum: ['Customer', 'Supplier'],
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  mode: {
    type: String,
    enum: ['Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'Card', 'Finance'],
    required: true
  },
  referenceNo: {
    type: String,
    trim: true,
    default: ''
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
