const Purchase = require('./purchase.model');
const Vehicle = require('../vehicles/vehicle.model');
const Supplier = require('../suppliers/supplier.model');
const Product = require('../products/product.model');
const { logAudit } = require('../utils/audit');
const mongoose = require('mongoose');

const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().populate('supplier').sort({ date: -1 });
    res.json(purchases);
  } catch (error) {
    console.error('getPurchases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier')
      .populate('items.product');
    
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase record not found' });
    }
    
    // Also fetch the individual vehicle units created under this purchase invoice
    const vehicles = await Vehicle.find({ purchaseInvoice: purchase._id }).populate('product');
    
    res.json({
      purchase,
      vehicles
    });
  } catch (error) {
    console.error('getPurchaseById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { purchaseOrderNo, invoiceNo, supplier, date, items, vehicles } = req.body;
    
    if (!invoiceNo || !supplier || !items || items.length === 0) {
      return res.status(400).json({ message: 'Please provide supplier details, invoice number and purchase items' });
    }
    
    // Calculate financial figures
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalAmount = 0;
    
    // Fetch supplier to see state (Rajasthan is local since company is Rajasthan, GSTIN starts with 08)
    const supplierDoc = await Supplier.findById(supplier).session(session);
    if (!supplierDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    const isInterState = supplierDoc.gstin && !supplierDoc.gstin.startsWith('08');
    
    const preparedItems = [];
    for (const item of items) {
      const productDoc = await Product.findById(item.product).session(session);
      if (!productDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }
      
      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice); // Inclusive of GST
      const gstRate = Number(item.gstRate || productDoc.gstRate || 18);
      
      const itemTotal = qty * price;
      const itemTaxable = itemTotal / (1 + (gstRate / 100));
      const itemGst = itemTotal - itemTaxable;
      
      taxableAmount += itemTaxable;
      if (isInterState) {
        igstAmount += itemGst;
      } else {
        cgstAmount += itemGst / 2;
        sgstAmount += itemGst / 2;
      }
      totalAmount += itemTotal;
      
      preparedItems.push({
        product: item.product,
        quantity: qty,
        purchasePrice: price,
        gstRate,
        gstAmount: itemGst,
        totalAmount: itemTotal
      });
    }
    
    const purchase = new Purchase({
      purchaseOrderNo: purchaseOrderNo || '',
      invoiceNo,
      supplier,
      date: date || new Date(),
      items: preparedItems,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      paymentStatus: 'Paid',
      outstandingAmount: 0
    });
    
    await purchase.save({ session });
    
    // Add supplier outstanding balance
    supplierDoc.balance += purchase.outstandingAmount; // Adds 0 since purchase is Paid
    await supplierDoc.save({ session });
    
    // If there are vehicles received, check duplicate identifiers and create vehicle records
    if (vehicles && vehicles.length > 0) {
      for (const v of vehicles) {
        if (!v.chassisNo || !v.motorNo || !v.batteryNo || !v.product || !v.color || !v.controllerNo || !v.chargerNo) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            message: 'Each vehicle must contain chassis, motor, battery, controller, and charger numbers, color, and product model' 
          });
        }
        
        // Check duplicates
        const dupChassis = await Vehicle.findOne({ chassisNo: v.chassisNo }).session(session);
        if (dupChassis) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Chassis ${v.chassisNo} already exists in inventory` });
        }
        
        const dupMotor = await Vehicle.findOne({ motorNo: v.motorNo }).session(session);
        if (dupMotor) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Motor ${v.motorNo} already exists in inventory` });
        }
        
        const dupBattery = await Vehicle.findOne({ batteryNo: v.batteryNo }).session(session);
        if (dupBattery) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Battery ${v.batteryNo} already exists in inventory` });
        }
        
        const vehicleProduct = await Product.findById(v.product).session(session);
        if (!vehicleProduct || vehicleProduct.type !== 'Vehicle') {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Invalid product or product is not a vehicle model' });
        }
        
        const newVehicle = new Vehicle({
          chassisNo: v.chassisNo.toUpperCase(),
          motorNo: v.motorNo.toUpperCase(),
          batteryNo: v.batteryNo.toUpperCase(),
          batteryType: v.batteryType || vehicleProduct.batteryType || '60V/30AH',
          product: v.product,
          color: v.color || vehicleProduct.color || 'Glossy Black',
          controllerNo: (v.controllerNo || v.controllerNumber || '').toString().trim().toUpperCase(),
          chargerNo: (v.chargerNo || v.chargerNumber || '').toString().trim().toUpperCase(),
          status: 'RECEIVED',
          purchaseInvoice: purchase._id,
          purchaseDate: purchase.date,
          costPrice: v.costPrice || vehicleProduct.purchasePrice,
          sellingPrice: v.sellingPrice || vehicleProduct.sellingPrice,
          location: 'Main Branch'
        });
        await newVehicle.save({ session });
      }
    }
    
    await commitTransaction(session);
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Purchase',
      entityId: purchase._id.toString(),
      details: `Recorded purchase invoice: ${invoiceNo} from supplier: ${supplierDoc.name}`,
      afterData: purchase.toObject()
    });
    
    res.status(201).json(purchase);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createPurchase error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Purchase record not found' });
    }

    const oldData = purchase.toObject();
    const { purchaseOrderNo, invoiceNo, date, supplier } = req.body;

    if (invoiceNo !== undefined) purchase.invoiceNo = invoiceNo;
    if (purchaseOrderNo !== undefined) purchase.purchaseOrderNo = purchaseOrderNo;
    if (date !== undefined) purchase.date = date;

    // Handle supplier change
    if (supplier !== undefined && supplier !== purchase.supplier.toString()) {
      const oldSupplier = await Supplier.findById(purchase.supplier).session(session);
      if (oldSupplier) {
        oldSupplier.balance = Math.max(0, oldSupplier.balance - purchase.outstandingAmount);
        await oldSupplier.save({ session });
      }

      const newSupplier = await Supplier.findById(supplier).session(session);
      if (newSupplier) {
        newSupplier.balance += purchase.outstandingAmount;
        await newSupplier.save({ session });
        purchase.supplier = supplier;
      }
    }

    await purchase.save({ session });
    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Purchase',
      entityId: purchase._id.toString(),
      details: `Updated purchase invoice: ${purchase.invoiceNo}`,
      beforeData: oldData,
      afterData: purchase.toObject()
    });

    res.json(purchase);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('updatePurchase error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Purchase record not found' });
    }

    const supplierDoc = await Supplier.findById(purchase.supplier).session(session);
    if (supplierDoc) {
      // Revert supplier outstanding balance
      supplierDoc.balance = Math.max(0, supplierDoc.balance - purchase.outstandingAmount);
      await supplierDoc.save({ session });
    }

    // Delete associated vehicles received under this purchase
    await Vehicle.deleteMany({ purchaseInvoice: req.params.id }).session(session);

    // Delete the purchase record
    await Purchase.deleteOne({ _id: req.params.id }).session(session);

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Purchase',
      entityId: req.params.id,
      details: `Deleted purchase invoice: ${purchase.invoiceNo}. Ledger & stock reverted.`,
      beforeData: purchase.toObject()
    });

    res.json({ message: 'Purchase record deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('deletePurchase error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

const commitTransaction = async (session) => {
  await session.commitTransaction();
  session.endSession();
};

module.exports = {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase
};
