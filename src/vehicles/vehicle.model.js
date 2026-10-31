const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  chassisNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  motorNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  batteryNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  controllerNo: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  chargerNo: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['IN TRANSIT', 'RECEIVED', 'AVAILABLE', 'RESERVED', 'SOLD', 'DELIVERED', 'RETURNED', 'DAMAGED', 'SERVICE'],
    default: 'RECEIVED'
  },
  purchaseInvoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null
  },
  purchaseDate: {
    type: Date,
    default: null
  },
  costPrice: {
    type: Number,
    default: 0
  },
  sellingPrice: {
    type: Number,
    default: 0
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  warrantyEnd: {
    type: Date,
    default: null
  },
  location: {
    type: String,
    default: 'Main Branch'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
