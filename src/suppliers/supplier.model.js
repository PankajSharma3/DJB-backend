const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    default: ''
  },
  pan: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  balance: {
    type: Number,
    default: 0 // Outstanding payable amount to the supplier
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);
