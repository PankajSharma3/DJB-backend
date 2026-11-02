const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Vehicle', 'Spare Part', 'Accessory'],
    required: true
  },
  category: {
    type: String,
    default: 'General'
  },
  hsnCode: {
    type: String,
    required: true,
    trim: true
  },
  gstRate: {
    type: Number,
    required: true,
    default: 18 // 18% standard, EVs are usually 5%
  },
  purchasePrice: {
    type: Number,
    default: 0
  },
  sellingPrice: {
    type: Number,
    default: 0
  },
  minStock: {
    type: Number,
    default: 2
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  batteryType: {
    type: String,
    enum: ['60V/30AH', '60V/40AH', '60V/52AH', 'N/A'],
    default: '60V/30AH'
  },
  controllerNo: {
    type: String,
    trim: true,
    default: ''
  },
  chargerNo: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for fast search and filtering
productSchema.index({ name: 1 });
productSchema.index({ type: 1 });
productSchema.index({ category: 1 });
productSchema.index({ color: 1 });

module.exports = mongoose.model('Product', productSchema);
