const Company = require('./company.model');
const { logAudit } = require('../utils/audit');

const getSettings = async (req, res) => {
  try {
    let settings = await Company.findOne();
    if (!settings) {
      // Create default
      settings = new Company();
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
    let settings = await Company.findOne();
    const oldData = settings ? settings.toObject() : null;
    
    if (!settings) {
      settings = new Company(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    
    await settings.save();
    
    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Company',
      entityId: settings._id.toString(),
      details: 'Company settings updated',
      beforeData: oldData,
      afterData: settings.toObject()
    });
    
    res.json(settings);
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
