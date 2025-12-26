const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Helper function to log updates to audit_logs
const logAuditEvent = async (client, userId, tenantId, action, entityType, entityId, ipAddress) => {
  try {
    await client.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), tenantId, userId, action, entityType, entityId, ipAddress]
    );
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// Helper function to calculate tenant stats
const calculateTenantStats = async (client, tenantId) => {
  const [usersResult, projectsResult, tasksResult] = await Promise.all([
    client.query('SELECT COUNT(*) as count FROM users WHERE tenant_id = $1', [tenantId]),
    client.query('SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1', [tenantId]),
    client.query('SELECT COUNT(*) as count FROM tasks WHERE tenant_id = $1', [tenantId])
  ]);

  return {
    totalUsers: parseInt(usersResult.rows[0].count),
    totalProjects: parseInt(projectsResult.rows[0].count),
    totalTasks: parseInt(tasksResult.rows[0].count)
  };
};

const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenantId, userId } = req.user;

    // Enforce Tenant Isolation: If role !== super_admin, ensure req.user.tenantId === req.params.tenantId
    if (role !== 'super_admin' && tenantId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot view other tenants'
      });
    }

    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, name, subdomain, status, subscription_plan, 
               max_users, max_projects, created_at, updated_at
        FROM tenants 
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Calculate tenant stats
      const stats = await calculateTenantStats(client, id);
      
      // Log audit event
      await logAuditEvent(
        client, userId, tenantId, 'view_tenant', 'tenant', id, 
        req.ip || req.connection.remoteAddress
      );

      res.status(200).json({
        success: true,
        data: {
          ...result.rows[0],
          stats
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get tenant',
      error: error.message
    });
  }
};

const updateTenant = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { role, tenantId, userId } = req.user;
    const { name, status, subscriptionPlan, maxUsers, maxProjects } = req.body;

    // Enforce Tenant Isolation: If role !== super_admin, ensure req.user.tenantId === req.params.tenantId
    if (role !== 'super_admin' && tenantId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot update other tenants'
      });
    }

    // ❌ BUSINESS RULES: tenant_admin cannot update restricted fields
    if (role === 'tenant_admin' && (status || subscriptionPlan || maxUsers || maxProjects)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: tenant_admin cannot modify subscriptionPlan, status, maxUsers, or maxProjects'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    // ✅ Only super_admin can update these fields
    if (role === 'super_admin') {
      if (status) {
        updates.push(`status = $${paramCount++}`);
        values.push(status);
      }
      if (subscriptionPlan) {
        updates.push(`subscription_plan = $${paramCount++}`);
        values.push(subscriptionPlan);
      }
      if (maxUsers) {
        updates.push(`max_users = $${paramCount++}`);
        values.push(maxUsers);
      }
      if (maxProjects) {
        updates.push(`max_projects = $${paramCount++}`);
        values.push(maxProjects);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE tenants 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, name, subdomain, status, subscription_plan, 
                max_users, max_projects, created_at, updated_at
    `;

    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Calculate updated stats
    const stats = await calculateTenantStats(client, id);

    // Always log updates to audit_logs
    const updateDetails = Object.keys(req.body).join(', ');
    await logAuditEvent(
      client, userId, tenantId, `update_tenant: ${updateDetails}`, 'tenant', id,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Tenant updated successfully',
      data: {
        ...result.rows[0],
        stats
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const listTenants = async (req, res) => {
  try {
    const { role, tenantId, userId } = req.user;

    const client = await pool.connect();
    
    try {
      let query;
      let values = [];
      let tenantsData = [];

      if (role === 'super_admin') {
        // super_admin can see all tenants
        query = `
          SELECT id, name, subdomain, status, subscription_plan, 
                 max_users, max_projects, created_at, updated_at
          FROM tenants 
          ORDER BY created_at DESC
        `;
        
        const result = await client.query(query);
        
        // Calculate stats for each tenant
        for (const tenant of result.rows) {
          const stats = await calculateTenantStats(client, tenant.id);
          tenantsData.push({
            ...tenant,
            stats
          });
        }
        
      } else if (role === 'tenant_admin') {
        // tenant_admin can only see their own tenant
        query = `
          SELECT id, name, subdomain, status, subscription_plan, 
                 max_users, max_projects, created_at, updated_at
          FROM tenants 
          WHERE id = $1
        `;
        values = [tenantId];
        
        const result = await client.query(query, values);
        
        if (result.rows.length > 0) {
          const stats = await calculateTenantStats(client, result.rows[0].id);
          tenantsData.push({
            ...result.rows[0],
            stats
          });
        }
        
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // Log audit event
      await logAuditEvent(
        client, userId, tenantId, 'list_tenants', 'tenant', null,
        req.ip || req.connection.remoteAddress
      );

      res.status(200).json({
        success: true,
        data: tenantsData,
        count: tenantsData.length
      });
      
    } finally {
      client.release();
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list tenants',
      error: error.message
    });
  }
};

module.exports = {
  getTenantById,
  updateTenant,
  listTenants
};
