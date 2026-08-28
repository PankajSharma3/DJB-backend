const AuditLog = require('../audit/audit_log.model');

const logAudit = async ({ user, action, entity, entityId, details, beforeData, afterData }) => {
  try {
    const log = new AuditLog({
      user: user || 'System',
      action,
      entity,
      entityId: entityId || '',
      details: details || '',
      beforeData,
      afterData
    });
    await log.save();
  } catch (error) {
    console.error('Audit Log save error:', error);
  }
};

module.exports = { logAudit };
