const Product = require('./product.model');
const Vehicle = require('../vehicles/vehicle.model');
const { logAudit } = require('../utils/audit');

const getProducts = async (req, res) => {
  try {
    const { type, available, sellable } = req.query;
    const filter = {};
    if (type) filter.type = type;
    
    const products = await Product.find(filter).sort({ name: 1 }).lean();
    
    // Aggregate real-time vehicle stock status breakdown per product
    const productIds = products.map(p => p._id);
    const vehicleCounts = await Vehicle.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: {
          _id: { product: '$product', status: '$status' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stockMap = {};
    vehicleCounts.forEach(vc => {
      const pId = vc._id.product.toString();
      if (!stockMap[pId]) {
        stockMap[pId] = { available: 0, reserved: 0, returned: 0, sold: 0, inTransit: 0, damaged: 0, service: 0, total: 0 };
      }
      const st = (vc._id.status || '').toString().trim().toUpperCase();
      if (st === 'AVAILABLE') stockMap[pId].available += vc.count;
      else if (st === 'RESERVED') stockMap[pId].reserved += vc.count;
      else if (st === 'RETURNED') stockMap[pId].returned += vc.count;
      else if (st === 'SOLD' || st === 'DELIVERED') stockMap[pId].sold += vc.count;
      else if (st === 'IN TRANSIT' || st === 'RECEIVED') stockMap[pId].inTransit += vc.count;
      else if (st === 'DAMAGED') stockMap[pId].damaged += vc.count;
      else if (st === 'SERVICE') stockMap[pId].service += vc.count;
      stockMap[pId].total += vc.count;
    });

    const enrichedProducts = products.map(p => {
      const s = stockMap[p._id.toString()] || { available: 0, reserved: 0, returned: 0, sold: 0, inTransit: 0, damaged: 0, service: 0, total: 0 };
      return {
        ...p,
        stockSummary: s,
        availableStock: p.type === 'Vehicle' ? s.available : (p.minStock || 10),
        isAvailableForSale: p.type === 'Vehicle' ? s.available > 0 : true,
        isAvailableForQuote: p.type === 'Vehicle' ? s.available > 0 : true
      };
    });

    let resultProducts = enrichedProducts;
    if (available === 'true' || sellable === 'true') {
      resultProducts = resultProducts.filter(p => p.isAvailableForSale);
    }

    res.json(resultProducts);
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
      batteryType,
      controllerNo,
      chargerNo,
      controllerNumber,
      chargerNumber
    } = req.body;
    
    const finalColor = (color || '').toString().trim();
    const finalControllerNo = (controllerNo || controllerNumber || '').toString().trim();
    const finalChargerNo = (chargerNo || chargerNumber || '').toString().trim();
    const finalBatteryType = batteryType || (type === 'Vehicle' ? '60V/30AH' : 'N/A');

    if (!name || !type || !hsnCode || gstRate === undefined || !finalColor) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: Name, Type, HSN Code, GST Rate, and Color are mandatory' 
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
      batteryType: finalBatteryType,
      controllerNo: finalControllerNo,
      chargerNo: finalChargerNo
    });
    
    await product.save();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Product',
      entityId: product._id.toString(),
      details: `Created product: ${name} (${type}, Color: ${finalColor}, Battery Type: ${finalBatteryType})`,
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
