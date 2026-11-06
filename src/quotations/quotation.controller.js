const Quotation = require('./quotation.model');
const Product = require('../products/product.model');
const { logAudit } = require('../utils/audit');

const getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find().populate('items.product').sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    console.error('getQuotations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('items.product');
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    res.json(quotation);
  } catch (error) {
    console.error('getQuotationById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createQuotation = async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, customerGstin, customerAadhar, items, discountAmount, placeOfSupply, taxCalculationMode = 'EXCLUSIVE' } = req.body;
    
    if (!customerName || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({ message: 'Customer name, phone, and items are required' });
    }

    const quotationNo = 'QTN-' + Date.now();
    const isInterState = customerGstin ? !customerGstin.startsWith('08') : (placeOfSupply !== 'Rajasthan');
    
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalAmount = 0;
    
    const preparedItems = [];
    
    for (const item of items) {
      const productDoc = await Product.findById(item.product);
      if (!productDoc) {
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }
      
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || productDoc.sellingPrice);
      const discount = Number(item.discount || 0);
      const gstRate = Number(productDoc.gstRate || 18);
      
      let itemTaxable = 0;
      let itemGst = 0;
      let itemTotal = 0;

      if (taxCalculationMode === 'INCLUSIVE') {
        const grossAmount = (qty * price) - discount;
        itemTaxable = Number((grossAmount / (1 + (gstRate / 100))).toFixed(2));
        itemGst = Number((grossAmount - itemTaxable).toFixed(2));
        itemTotal = grossAmount;
      } else {
        itemTaxable = Number(((qty * price) - discount).toFixed(2));
        itemGst = Number((itemTaxable * (gstRate / 100)).toFixed(2));
        itemTotal = Number((itemTaxable + itemGst).toFixed(2));
      }
      
      taxableAmount += itemTaxable;
      
      const cgstRate = isInterState ? 0 : gstRate / 2;
      const cgstVal = isInterState ? 0 : Number((itemGst / 2).toFixed(2));
      const sgstRate = isInterState ? 0 : gstRate / 2;
      const sgstVal = isInterState ? 0 : Number((itemGst / 2).toFixed(2));
      const igstRate = isInterState ? gstRate : 0;
      const igstVal = isInterState ? itemGst : 0;
      
      if (isInterState) {
        igstAmount += igstVal;
      } else {
        cgstAmount += cgstVal;
        sgstAmount += sgstVal;
      }
      
      totalAmount += itemTotal;
      
      preparedItems.push({
        product: item.product,
        price,
        quantity: qty,
        discount,
        taxable: itemTaxable,
        cgstRate,
        cgstAmount: cgstVal,
        sgstRate,
        sgstAmount: sgstVal,
        igstRate,
        igstAmount: igstVal,
        total: itemTotal
      });
    }
    
    // Apply discountAmount if provided at header level
    const headerDiscount = Number(discountAmount || 0);
    taxableAmount = Math.max(0, taxableAmount - headerDiscount);
    
    const netTotal = Math.max(0, totalAmount - headerDiscount);
    const finalTotal = Math.round(netTotal);
    const roundOff = Number((finalTotal - netTotal).toFixed(2));
    
    const quotation = new Quotation({
      quotationNo,
      customerName,
      customerPhone,
      customerAddress: customerAddress || '',
      customerGstin: customerGstin || '',
      customerAadhar: customerAadhar || '',
      taxCalculationMode,
      date: new Date(),
      items: preparedItems,
      discountAmount: headerDiscount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOff,
      totalAmount: finalTotal,
      status: 'SENT'
    });
    
    await quotation.save();
    
    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Quotation',
      entityId: quotation._id.toString(),
      details: `Generated quotation ${quotationNo} for customer ${customerName}`,
      afterData: quotation.toObject()
    });
    
    res.status(201).json(quotation);
  } catch (error) {
    console.error('createQuotation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateQuotationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Please provide status' });

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    
    const oldData = quotation.toObject();
    quotation.status = status;
    await quotation.save();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Quotation',
      entityId: quotation._id.toString(),
      details: `Updated quotation ${quotation.quotationNo} status to: ${status}`,
      beforeData: oldData,
      afterData: quotation.toObject()
    });
    
    res.json(quotation);
  } catch (error) {
    console.error('updateQuotationStatus error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }
    
    await Quotation.findByIdAndDelete(req.params.id);
    
    await logAudit({
      user: req.user.email,
      action: 'DELETE',
      entity: 'Quotation',
      entityId: req.params.id,
      details: `Deleted quotation ${quotation.quotationNo}`,
      beforeData: quotation.toObject()
    });
    
    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    console.error('deleteQuotation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  deleteQuotation
};
