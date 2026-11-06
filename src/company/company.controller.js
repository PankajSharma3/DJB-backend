const Company = require('./company.model');
const { logAudit } = require('../utils/audit');

const getSettings = async (req, res) => {
  try {
    let settings = await Company.findOne();
    if (!settings) {
      settings = new Company({ taxCalculationMode: 'INCLUSIVE' });
      await settings.save();
    } else if (settings.taxCalculationMode !== 'INCLUSIVE' && !settings.taxModeManuallyConfigured) {
      settings.taxCalculationMode = 'INCLUSIVE';
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { 
      legalName, tradeName, pan, gstin, address, bankDetails, 
      upiId, logoUrl, signatureUrl, invoicePrefix, invoiceSuffix, 
      taxCalculationMode, phone, email 
    } = req.body;

    const updateFields = {};
    if (legalName !== undefined) updateFields.legalName = legalName;
    if (tradeName !== undefined) updateFields.tradeName = tradeName;
    if (pan !== undefined) updateFields.pan = pan;
    if (gstin !== undefined) updateFields.gstin = gstin;
    if (address !== undefined) updateFields.address = address;
    if (bankDetails !== undefined) updateFields.bankDetails = bankDetails;
    if (upiId !== undefined) updateFields.upiId = upiId;
    if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;
    if (signatureUrl !== undefined) updateFields.signatureUrl = signatureUrl;
    if (invoicePrefix !== undefined) updateFields.invoicePrefix = invoicePrefix;
    if (invoiceSuffix !== undefined) updateFields.invoiceSuffix = invoiceSuffix;
    if (taxCalculationMode !== undefined) {
      updateFields.taxCalculationMode = taxCalculationMode;
      updateFields.taxModeManuallyConfigured = true;
    }
    if (phone !== undefined) updateFields.phone = phone;
    if (email !== undefined) updateFields.email = email;

    const oldData = await Company.findOne();
    const settings = await Company.findOneAndUpdate(
      {},
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true }
    );
    
    await logAudit({
      user: req.user?.email || 'admin@djbevworld.com',
      action: 'UPDATE',
      entity: 'Company',
      entityId: settings._id.toString(),
      details: `Company settings updated: taxCalculationMode=${settings.taxCalculationMode}`,
      beforeData: oldData ? oldData.toObject() : null,
      afterData: settings.toObject()
    });
    
    res.json(settings);
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
