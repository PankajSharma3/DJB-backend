const Product = require('./product.model');
const { logAudit } = require('../utils/audit');

const getProducts = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = {};
    if (type) filter.type = type;
    
    const products = await Product.find(filter).sort({ name: 1 }).lean();
    res.json(products);
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
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
    const { 
      name, 
      type, 
      category, 
      hsnCode, 
      gstRate, 
      purchasePrice, 
      sellingPrice, 
      minStock,
      color,
      controllerNo,
      chargerNo,
      controllerNumber,
      chargerNumber
    } = req.body;
    
    const finalColor = (color || '').toString().trim();
    const finalControllerNo = (controllerNo || controllerNumber || '').toString().trim();
    const finalChargerNo = (chargerNo || chargerNumber || '').toString().trim();

    if (!name || !type || !hsnCode || gstRate === undefined || !finalColor || !finalControllerNo || !finalChargerNo) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: Name, Type, HSN Code, GST Rate, Color, Controller Number, and Charger Number are mandatory' 
      });
    }
    
    const product = new Product({
      name: name.toString().trim(),
      type,
      category: category ? category.toString().trim() : 'General',
      hsnCode: hsnCode.toString().trim(),
      gstRate: Number(gstRate),
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      minStock: minStock !== undefined ? Number(minStock) : 2,
      color: finalColor,
      controllerNo: finalControllerNo,
      chargerNo: finalChargerNo
    });
    
    await product.save();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Product',
      entityId: product._id.toString(),
      details: `Created product: ${name} (${type}, Color: ${finalColor}, Controller: ${finalControllerNo}, Charger: ${finalChargerNo})`,
      afterData: product.toObject()
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const oldData = product.toObject();
    const updateData = { ...req.body };

    // Normalize field names
    if (updateData.controllerNumber && !updateData.controllerNo) {
      updateData.controllerNo = updateData.controllerNumber;
    }
    if (updateData.chargerNumber && !updateData.chargerNo) {
      updateData.chargerNo = updateData.chargerNumber;
    }

    if (updateData.color !== undefined && !updateData.color.toString().trim()) {
      return res.status(400).json({ message: 'Color is required and cannot be empty' });
    }
    if (updateData.controllerNo !== undefined && !updateData.controllerNo.toString().trim()) {
      return res.status(400).json({ message: 'Controller Number is required and cannot be empty' });
    }
    if (updateData.chargerNo !== undefined && !updateData.chargerNo.toString().trim()) {
      return res.status(400).json({ message: 'Charger Number is required and cannot be empty' });
    }

    Object.assign(product, updateData);
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
    res.status(500).json({ message: error.message || 'Server error' });
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
