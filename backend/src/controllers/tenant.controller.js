const { pool } = require('../config/db');
const { randomUUID } = require('crypto');
const logAudit = require('../utils/auditLogger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

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
      return sendError(res, 403, 'Access denied: Cannot view other tenants');
    }

    const client = await pool.connect();

    try {
      // Get tenant info
      const tenantResult = await client.query(
        'SELECT id, name, status, subscription_type, max_users, max_projects, created_at FROM tenants WHERE id = $1',
        [id]
      );

      if (tenantResult.rows.length === 0) {
        return sendError(res, 404, 'Tenant not found');
      }

      const tenant = tenantResult.rows[0];

      // Calculate tenant stats
      const stats = await calculateTenantStats(client, id);

      // Log audit trail
      await logAudit(id, userId, 'READ', 'tenant', id, {
        accessedBy: role
      });

      return sendSuccess(res, 200, {
        tenant: {
          ...tenant,
          stats
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Get tenant error:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

const updateTenant = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { role, tenantId, userId } = req.user;
    const { name, status, subscriptionType, maxUsers, maxProjects } = req.body;

    // BUSINESS RULE: Only super_admin can update tenants
    if (role !== 'super_admin') {
      return sendError(res, 403, 'Access denied: Only super administrators can update tenants');
    }

    // Enforce Tenant Isolation (even super_admin should use correct tenant ID)
    if (tenantId !== id) {
      return sendError(res, 403, 'Access denied: Tenant ID mismatch');
    }

    // Get current tenant to verify it exists
    const currentTenant = await client.query(
      'SELECT id, name, max_users, max_projects FROM tenants WHERE id = $1',
      [id]
    );

    if (currentTenant.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Tenant not found');
    }

    const tenant = currentTenant.rows[0];

    // If reducing limits, check current usage
    if (maxUsers && maxUsers < tenant.max_users) {
      const userCount = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true',
        [id]
      );
      
      if (parseInt(userCount.rows[0].count) > maxUsers) {
        await client.query('ROLLBACK');
        return sendError(res, 400, `Cannot reduce user limit: Current usage (${userCount.rows[0].count}) exceeds new limit (${maxUsers})`);
      }
    }

    if (maxProjects && maxProjects < tenant.max_projects) {
      const projectCount = await client.query(
        'SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1',
        [id]
      );
      
      if (parseInt(projectCount.rows[0].count) > maxProjects) {
        await client.query('ROLLBACK');
        return sendError(res, 400, `Cannot reduce project limit: Current usage (${projectCount.rows[0].count}) exceeds new limit (${maxProjects})`);
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (subscriptionType !== undefined) {
      updates.push(`subscription_type = $${paramCount++}`);
      values.push(subscriptionType);
    }

    if (maxUsers !== undefined) {
      updates.push(`max_users = $${paramCount++}`);
      values.push(maxUsers);
    }

    if (maxProjects !== undefined) {
      updates.push(`max_projects = $${paramCount++}`);
      values.push(maxProjects);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'No valid fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE tenants SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, name, status, subscription_type, max_users, max_projects, created_at, updated_at`,
      values
    );

    // Log audit trail
    await logAudit(id, userId, 'UPDATE', 'tenant', id, {
      updatedFields: { name, status, subscriptionType, maxUsers, maxProjects }
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, {
      tenant: result.rows[0]
    }, 'Tenant updated successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update tenant error:', error);
    return sendError(res, 500, 'Internal server error');
  } finally {
    client.release();
  }
};

const listTenants = async (req, res) => {
  try {
    const { role, tenantId, userId } = req.user;

    // BUSINESS RULE: Only super_admin can list all tenants
    if (role !== 'super_admin') {
      // Non-super admin can only see their own tenant
      const client = await pool.connect();
      
      try {
        const tenantResult = await client.query(
          'SELECT id, name, status, subscription_type, max_users, max_projects, created_at FROM tenants WHERE id = $1',
          [tenantId]
        );

        if (tenantResult.rows.length === 0) {
          return sendError(res, 403, 'Access denied: Tenant not found');
        }

        const tenant = tenantResult.rows[0];
        const stats = await calculateTenantStats(client, tenantId);

        return sendSuccess(res, 200, {
          tenants: [{
            ...tenant,
            stats
          }],
          count: 1
        });

      } finally {
        client.release();
      }
    }

    // Super admin can see all tenants
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT id, name, status, subscription_type, max_users, max_projects, created_at FROM tenants ORDER BY created_at DESC'
      );

      // Get stats for each tenant
      const tenantsWithStats = await Promise.all(
        result.rows.map(async (tenant) => {
          const stats = await calculateTenantStats(client, tenant.id);
          return {
            ...tenant,
            stats
          };
        })
      );

      return sendSuccess(res, 200, {
        tenants: tenantsWithStats,
        count: tenantsWithStats.length
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('List tenants error:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

module.exports = {
  getTenantById,
  updateTenant,
  listTenants
};
