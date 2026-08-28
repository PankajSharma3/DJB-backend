const Product = require('./product.model');
const { logAudit } = require('../utils/audit');

const getProducts = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = type;
    
    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, type, category, hsnCode, gstRate, purchasePrice, sellingPrice, minStock } = req.body;
    
    if (!name || !type || !hsnCode || !gstRate) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    const product = new Product({
      name,
      type,
      category,
      hsnCode,
      gstRate,
      purchasePrice,
      sellingPrice,
      minStock
    });
    
    await product.save();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Product',
      entityId: product._id.toString(),
      details: `Created product: ${name} (${type})`,
      afterData: product.toObject()
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const oldData = product.toObject();
    Object.assign(product, req.body);
    await product.save();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Product',
      entityId: product._id.toString(),
      details: `Updated product: ${product.name}`,
      beforeData: oldData,
      afterData: product.toObject()
    });
    
    res.json(product);
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const oldData = product.toObject();
    await Product.findByIdAndDelete(req.params.id);
    
    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Product',
      entityId: req.params.id,
      details: `Deleted product: ${product.name}`,
      beforeData: oldData
    });
    
    res.json({ message: 'Product removed' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
