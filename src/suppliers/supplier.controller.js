const Supplier = require('./supplier.model');
const Purchase = require('../purchases/purchase.model');
const Payment = require('../payments/payment.model');
const { logAudit } = require('../utils/audit');

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 }).lean();
    res.json(suppliers);
  } catch (error) {
    console.error('getSuppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    // Fetch supplier purchases and payments
    const purchases = await Purchase.find({ supplier: req.params.id }).sort({ date: -1 });
    const payments = await Payment.find({ supplier: req.params.id }).sort({ date: -1 });
    
    res.json({
      supplier,
      purchases,
      payments
    });
  } catch (error) {
    console.error('getSupplierById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, pan, gstin, address, balance } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and Phone are required' });
    }
    
    const supplier = new Supplier({
      name,
      phone,
      email: email || '',
      pan: pan || '',
      gstin: gstin || '',
      address: address || '',
      balance: balance || 0
    });
    
    await supplier.save();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Supplier',
      entityId: supplier._id.toString(),
      details: `Created supplier record: ${name}`,
      afterData: supplier.toObject()
    });
    
    res.status(201).json(supplier);
  } catch (error) {
    console.error('createSupplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    const oldData = supplier.toObject();
    Object.assign(supplier, req.body);
    await supplier.save();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Supplier',
      entityId: supplier._id.toString(),
      details: `Updated supplier: ${supplier.name}`,
      beforeData: oldData,
      afterData: supplier.toObject()
    });
    
    res.json(supplier);
  } catch (error) {
    console.error('updateSupplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplierId = req.params.id;
    
    // Check associated purchases
    const purchaseCount = await Purchase.countDocuments({ supplier: supplierId });
    if (purchaseCount > 0) {
      return res.status(400).json({ message: 'Cannot delete supplier: Associated purchases exist.' });
    }
    
    // Check associated payments
    const paymentCount = await Payment.countDocuments({ supplier: supplierId });
    if (paymentCount > 0) {
      return res.status(400).json({ message: 'Cannot delete supplier: Associated payments exist.' });
    }
    
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    await Supplier.deleteOne({ _id: supplierId });
    
    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Supplier',
      entityId: supplierId,
      details: `Deleted supplier record: ${supplier.name}`,
      beforeData: supplier.toObject()
    });
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('deleteSupplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
