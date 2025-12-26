const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
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

const addUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { role, tenantId, userId } = req.user;
    const { tenantId: routeTenantId } = req.params;
    const { email, password, fullName, userRole = 'user' } = req.body;

    // STRICT BUSINESS RULE: Only tenant_admin and super_admin can add users
    if (role !== 'tenant_admin' && role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only tenant administrators and super administrators can add users'
      });
    }

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && routeTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot add users to other tenants'
      });
    }

    // Use the target tenant from route (super_admin) or user's tenant (tenant_admin)
    const targetTenantId = routeTenantId;

    // Get tenant info and check subscription limit
    const tenantQuery = await client.query(
      'SELECT max_users FROM tenants WHERE id = $1',
      [targetTenantId]
    );

    if (tenantQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const maxUsers = tenantQuery.rows[0].max_users;

    // Check current user count against subscription limit
    const userCountQuery = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true',
      [targetTenantId]
    );

    const currentUserCount = parseInt(userCountQuery.rows[0].count);

    if (currentUserCount >= maxUsers) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot add user: Subscription limit reached (${maxUsers} users maximum)`
      });
    }

    // Check if email already exists in this tenant
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email, targetTenantId]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Email already exists in this tenant'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const newUserId = uuidv4();

    // Create user
    const result = await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [newUserId, targetTenantId, email, passwordHash, fullName, userRole, true]
    );

    // Log audit event
    await logAuditEvent(
      client, userId, tenantId, 'add_user', 'user', newUserId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const listUsers = async (req, res) => {
  try {
    const { role, tenantId, userId } = req.user;
    const { tenantId: routeTenantId } = req.params;

    // STRICT BUSINESS RULE: Only tenant_admin and super_admin can list users
    if (role !== 'tenant_admin' && role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only tenant administrators and super administrators can list users'
      });
    }

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && routeTenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot list users from other tenants'
      });
    }

    const client = await pool.connect();

    try {
      // Use the target tenant from route
      const targetTenantId = routeTenantId;
      
      const query = `
        SELECT id, email, full_name, role, is_active, created_at, updated_at
        FROM users 
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [targetTenantId]);

      // Log audit event
      await logAuditEvent(
        client, userId, tenantId, 'list_users', 'user', null,
        req.ip || req.connection.remoteAddress
      );

      res.status(200).json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });

    } finally {
      client.release();
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list users',
      error: error.message
    });
  }
};

const updateUser = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { userId: targetUserId } = req.params;
    const { role, tenantId, userId } = req.user;
    const { fullName, userRole, isActive } = req.body;

    // Get target user to verify tenant access
    const targetUserQuery = await client.query(
      'SELECT tenant_id, role FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetUserQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUserTenantId = targetUserQuery.rows[0].tenant_id;

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && targetUserTenantId !== tenantId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot update users in other tenants'
      });
    }

    // STRICT BUSINESS RULES for updates
    if (targetUserId === userId) {
      // Users can only update their own fullName
      if (role !== 'tenant_admin' && role !== 'super_admin' && (userRole !== undefined || isActive !== undefined)) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Access denied: Users can only update their own full name'
        });
      }
    } else {
      // Only tenant_admin and super_admin can update other users' role/isActive
      if (role !== 'tenant_admin' && role !== 'super_admin') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only tenant administrators and super administrators can update user roles and status'
        });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (fullName) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(fullName);
    }

    if (userRole) {
      updates.push(`role = $${paramCount++}`);
      values.push(userRole);
    }

    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    values.push(targetUserId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, email, full_name, role, is_active, created_at, updated_at
    `;

    const result = await client.query(query, values);

    // Log audit event
    const updateDetails = Object.keys(req.body).join(', ');
    await logAuditEvent(
      client, userId, tenantId, `update_user: ${updateDetails}`, 'user', targetUserId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const deleteUser = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { userId: targetUserId } = req.params;
    const { role, tenantId, userId } = req.user;

    // STRICT BUSINESS RULE: Only tenant_admin and super_admin can delete users
    if (role !== 'tenant_admin' && role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only tenant administrators and super administrators can delete users'
      });
    }

    // Get target user to verify tenant access
    const targetUserQuery = await client.query(
      'SELECT tenant_id, email FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetUserQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUserTenantId = targetUserQuery.rows[0].tenant_id;
    const targetUserEmail = targetUserQuery.rows[0].email;

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && targetUserTenantId !== tenantId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot delete users in other tenants'
      });
    }

    // STRICT BUSINESS RULE: tenant_admin cannot delete themselves
    if (targetUserId === userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Access denied: Tenant administrators cannot delete themselves'
      });
    }

    // Delete user (soft delete by setting is_active = false)
    await client.query(
      'UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2',
      [new Date(), targetUserId]
    );

    // Log audit event
    await logAuditEvent(
      client, userId, tenantId, `delete_user: ${targetUserEmail}`, 'user', targetUserId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  addUser,
  listUsers,
  updateUser,
  deleteUser
};
