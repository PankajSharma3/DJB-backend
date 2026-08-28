const Lead = require('./lead.model');
const { logAudit } = require('../utils/audit');

const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    console.error('getLeads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createLead = async (req, res) => {
  try {
    const { name, phone, email, source, notes, assignedSalesperson } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone number are required' });
    }

    const lead = new Lead({
      name,
      phone,
      email: email || '',
      source: source || 'Walk-in',
      notes: notes || '',
      assignedSalesperson: assignedSalesperson || '',
      followUps: []
    });

    await lead.save();

    await logAudit({
      user: req.user.email,
      action: 'CREATE',
      entity: 'Lead',
      entityId: lead._id.toString(),
      details: `Created new lead: ${name}`,
      afterData: lead.toObject()
    });

    res.status(201).json(lead);
  } catch (error) {
    console.error('createLead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const oldData = lead.toObject();
    Object.assign(lead, req.body);
    await lead.save();

    await logAudit({
      user: req.user.email,
      action: 'UPDATE',
      entity: 'Lead',
      entityId: lead._id.toString(),
      details: `Updated lead ${lead.name} details. Status: ${lead.status}`,
      beforeData: oldData,
      afterData: lead.toObject()
    });

    res.json(lead);
  } catch (error) {
    console.error('updateLead error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addFollowUp = async (req, res) => {
  try {
    const { date, note } = req.body;
    if (!date || !note) {
      return res.status(400).json({ message: 'Follow-up date and note are required' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    lead.followUps.push({
      date,
      note,
      status: 'Pending'
    });

    await lead.save();
    res.json(lead);
  } catch (error) {
    console.error('addFollowUp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getLeads,
  createLead,
  updateLead,
  addFollowUp
};
