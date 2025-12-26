const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const logAudit = async ({
  tenantId = null,
  userId = null,
  action,
  entityType,
  entityId = null,
  ipAddress = null
}) => {
  await pool.query(
    `INSERT INTO audit_logs 
     (id, tenant_id, user_id, action, entity_type, entity_id, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uuidv4(), tenantId, userId, action, entityType, entityId, ipAddress]
  );
};

module.exports = logAudit;
