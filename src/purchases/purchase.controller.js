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
  const { purchaseOrderNo, invoiceNo, supplier, date, items, vehicles } = req.body;
  
  if (!invoiceNo || !supplier || !items || items.length === 0) {
    return res.status(400).json({ message: 'Please provide supplier details, invoice number and purchase items' });
  }

  // Pre-validate vehicle fields and in-memory duplicates before database calls
  if (vehicles && vehicles.length > 0) {
    const chassisSet = new Set();
    const motorSet = new Set();
    const batterySet = new Set();

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (!v.chassisNo || !v.motorNo || !v.batteryNo || !v.product || !v.color || !v.controllerNo || !v.chargerNo) {
        return res.status(400).json({ 
          message: `Vehicle #${i + 1} is missing required fields (chassis, motor, battery, controller, charger, color, or product model)` 
        });
      }

      const c = v.chassisNo.trim().toUpperCase();
      const m = v.motorNo.trim().toUpperCase();
      const b = v.batteryNo.trim().toUpperCase();

      if (chassisSet.has(c)) {
        return res.status(400).json({ message: `Duplicate chassis number ${c} in submission` });
      }
      if (motorSet.has(m)) {
        return res.status(400).json({ message: `Duplicate motor number ${m} in submission` });
      }
      if (batterySet.has(b)) {
        return res.status(400).json({ message: `Duplicate battery number ${b} in submission` });
      }

      chassisSet.add(c);
      motorSet.add(m);
      batterySet.add(b);
    }
  }

  const session = await mongoose.startSession();
  try {
    let createdPurchase = null;

    const executeOperation = async (sess) => {
      // 1. Fetch supplier
      const supplierDoc = await Supplier.findById(supplier).session(sess);
      if (!supplierDoc) {
        throw new Error('Supplier not found');
      }

      const isInterState = supplierDoc.gstin && !supplierDoc.gstin.startsWith('08');

      // 2. Batch fetch all referenced products in one query
      const itemProductIds = items.map(i => i.product);
      const vehicleProductIds = (vehicles || []).map(v => v.product);
      const allProductIds = [...new Set([...itemProductIds, ...vehicleProductIds])];
      
      const productDocs = await Product.find({ _id: { $in: allProductIds } }).session(sess);
      const productMap = new Map(productDocs.map(p => [p._id.toString(), p]));

      // 3. Calculate financial figures
      let taxableAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let totalAmount = 0;

      const preparedItems = [];
      for (const item of items) {
        const productDoc = productMap.get(item.product?.toString());
        if (!productDoc) {
          throw new Error(`Product ${item.product} not found`);
        }

        const qty = Number(item.quantity);
        const price = Number(item.purchasePrice);
        const gstRate = Number(item.gstRate !== undefined ? item.gstRate : (productDoc.gstRate || 18));

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

        // Keep product purchase price and selling price in sync with latest procurement
        const prodUpdate = { purchasePrice: price };
        if (item.sellingPrice) {
          prodUpdate.sellingPrice = Number(item.sellingPrice);
        }
        await Product.findByIdAndUpdate(item.product, prodUpdate, { session: sess });
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

      await purchase.save({ session: sess });

      // Add supplier outstanding balance
      supplierDoc.balance += purchase.outstandingAmount;
      await supplierDoc.save({ session: sess });

      // 4. Batch duplicate check for vehicles in ONE query
      if (vehicles && vehicles.length > 0) {
        const chassisList = vehicles.map(v => v.chassisNo.trim().toUpperCase());
        const motorList = vehicles.map(v => v.motorNo.trim().toUpperCase());
        const batteryList = vehicles.map(v => v.batteryNo.trim().toUpperCase());

        const existingVehicle = await Vehicle.findOne({
          $or: [
            { chassisNo: { $in: chassisList } },
            { motorNo: { $in: motorList } },
            { batteryNo: { $in: batteryList } }
          ]
        }).session(sess).lean();

        if (existingVehicle) {
          if (chassisList.includes(existingVehicle.chassisNo)) {
            throw new Error(`Chassis ${existingVehicle.chassisNo} already exists in inventory`);
          }
          if (motorList.includes(existingVehicle.motorNo)) {
            throw new Error(`Motor ${existingVehicle.motorNo} already exists in inventory`);
          }
          if (batteryList.includes(existingVehicle.batteryNo)) {
            throw new Error(`Battery ${existingVehicle.batteryNo} already exists in inventory`);
          }
        }

        const newVehicleDocs = vehicles.map(v => {
          const vehicleProduct = productMap.get(v.product?.toString());
          if (!vehicleProduct || vehicleProduct.type !== 'Vehicle') {
            throw new Error(`Invalid vehicle model product for chassis ${v.chassisNo}`);
          }

          return {
            chassisNo: v.chassisNo.trim().toUpperCase(),
            motorNo: v.motorNo.trim().toUpperCase(),
            batteryNo: v.batteryNo.trim().toUpperCase(),
            batteryType: vehicleProduct.batteryType || v.batteryType || '60V/30AH',
            product: v.product,
            color: v.color || vehicleProduct.color || 'Glossy Black',
            controllerNo: (v.controllerNo || v.controllerNumber || '').toString().trim().toUpperCase(),
            chargerNo: (v.chargerNo || v.chargerNumber || '').toString().trim().toUpperCase(),
            status: 'AVAILABLE',
            purchaseInvoice: purchase._id,
            purchaseDate: purchase.date,
            costPrice: Number(v.costPrice) || vehicleProduct.purchasePrice,
            sellingPrice: Number(v.sellingPrice) || vehicleProduct.sellingPrice,
            location: 'Main Branch'
          };
        });

        // 5. Batch insert vehicles in one single query
        await Vehicle.insertMany(newVehicleDocs, { session: sess });
      }

      createdPurchase = purchase;
      return purchase;
    };

    // Use withTransaction with automatic transient retry
    await session.withTransaction(async () => {
      await executeOperation(session);
    });

    await logAudit({
      user: req.user?.email || 'admin@djbevworld.com',
      action: 'CREATE',
      entity: 'Purchase',
      entityId: createdPurchase._id.toString(),
      details: `Recorded purchase invoice: ${invoiceNo} from supplier`,
      afterData: createdPurchase.toObject()
    });

    res.status(201).json(createdPurchase);
  } catch (error) {
    console.error('createPurchase error:', error);
    res.status(400).json({ message: error.message || 'Error processing purchase' });
  } finally {
    await session.endSession();
  }
};

const updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedPurchase = null;
    let oldData = null;

    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(req.params.id).session(session);
      if (!purchase) {
        throw new Error('Purchase record not found');
      }

      oldData = purchase.toObject();
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
      updatedPurchase = purchase;
    });

    await logAudit({
      user: req.user?.email || 'admin@djbevworld.com',
      action: 'UPDATE',
      entity: 'Purchase',
      entityId: updatedPurchase._id.toString(),
      details: `Updated purchase invoice: ${updatedPurchase.invoiceNo}`,
      beforeData: oldData,
      afterData: updatedPurchase.toObject()
    });

    res.json(updatedPurchase);
  } catch (error) {
    console.error('updatePurchase error:', error);
    res.status(400).json({ message: error.message || 'Server error' });
  } finally {
    await session.endSession();
  }
};

const deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let deletedInvoiceNo = '';
    let oldData = null;

    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(req.params.id).session(session);
      if (!purchase) {
        throw new Error('Purchase record not found');
      }

      deletedInvoiceNo = purchase.invoiceNo;
      oldData = purchase.toObject();

      const supplierDoc = await Supplier.findById(purchase.supplier).session(session);
      if (supplierDoc) {
        supplierDoc.balance = Math.max(0, supplierDoc.balance - purchase.outstandingAmount);
        await supplierDoc.save({ session });
      }

      // Delete associated vehicles received under this purchase
      await Vehicle.deleteMany({ purchaseInvoice: req.params.id }).session(session);

      // Delete the purchase record
      await Purchase.deleteOne({ _id: req.params.id }).session(session);
    });

    await logAudit({
      user: req.user?.email || 'admin@djbevworld.com',
      action: 'DELETE',
      entity: 'Purchase',
      entityId: req.params.id,
      details: `Deleted purchase invoice: ${deletedInvoiceNo}. Ledger & stock reverted.`,
      beforeData: oldData
    });

    res.json({ message: 'Purchase record deleted successfully' });
  } catch (error) {
    console.error('deletePurchase error:', error);
    res.status(400).json({ message: error.message || 'Server error' });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase
};
