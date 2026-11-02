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
  batteryType: {
    type: String,
    enum: ['60V/30AH', '60V/40AH', '60V/52AH', 'N/A'],
    default: '60V/30AH'
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

// Indexes for fast querying, filtering, and sorting
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ product: 1, status: 1 });
vehicleSchema.index({ createdAt: -1 });
vehicleSchema.index({ color: 1 });
vehicleSchema.index({ purchaseInvoice: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
