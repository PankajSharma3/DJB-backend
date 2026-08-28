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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
