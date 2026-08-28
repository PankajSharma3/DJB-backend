const mongoose = require('mongoose');

const salesOrderSchema = new mongoose.Schema({
  reservationNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null
  },
  reservationAmount: {
    type: Number,
    required: true,
    default: 0
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'INVOICED'],
    default: 'PENDING'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SalesOrder', salesOrderSchema);
