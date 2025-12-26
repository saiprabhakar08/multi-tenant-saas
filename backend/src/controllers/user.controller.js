const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logAudit = require('../utils/auditLogger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const addUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { role, tenantId, userId } = req.user;
    const { tenantId: routeTenantId } = req.params;
    const { email, password, fullName, userRole = 'user' } = req.body;

    // STRICT BUSINESS RULE: Only tenant_admin and super_admin can add users
    if (role !== 'tenant_admin' && role !== 'super_admin') {
      return sendError(res, 403, 'Access denied: Only tenant administrators and super administrators can add users');
    }

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && routeTenantId !== tenantId) {
      return sendError(res, 403, 'Access denied: Cannot add users to other tenants');
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
      return sendError(res, 404, 'Tenant not found');
    }

    const maxUsers = tenantQuery.rows[0].max_users;

    // Check current user count against subscription limit
    const userCountQuery = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true',
      [targetTenantId]
    );

    const currentCount = parseInt(userCountQuery.rows[0].count);
    
    if (currentCount >= maxUsers) {
      await client.query('ROLLBACK');
      return sendError(res, 400, `Cannot add user: Subscription limit reached (${maxUsers} users maximum)`);
    }

    // Check if email already exists in this tenant
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email, targetTenantId]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return sendError(res, 409, 'Email already exists in this tenant');
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

    // Log the audit trail
    await logAudit(targetTenantId, userId, 'CREATE', 'user', newUserId, {
      userEmail: email,
      userRole,
      adminRole: role
    });

    await client.query('COMMIT');

    const newUser = result.rows[0];
    return sendSuccess(res, 201, {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    }, 'User created successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add user error:', error);
    return sendError(res, 500, 'Internal server error');
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
      return sendError(res, 403, 'Access denied: Only tenant administrators and super administrators can list users');
    }

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && routeTenantId !== tenantId) {
      return sendError(res, 403, 'Access denied: Cannot list users from other tenants');
    }

    // Use the target tenant from route (super_admin) or user's tenant (tenant_admin)
    const targetTenantId = routeTenantId;

    // Query users in the tenant
    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at, updated_at 
       FROM users 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [targetTenantId]
    );

    // Log the audit trail
    await logAudit(targetTenantId, userId, 'READ', 'user_list', null, {
      userCount: result.rows.length,
      adminRole: role
    });

    const users = result.rows.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    return sendSuccess(res, 200, {
      users,
      count: users.length
    });

  } catch (error) {
    console.error('List users error:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

const updateUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { role, tenantId, userId: requestUserId } = req.user;
    const { tenantId: routeTenantId, userId } = req.params;
    const { fullName, userRole, isActive } = req.body;

    // Get the target user first
    const userQuery = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'User not found');
    }

    const targetUser = userQuery.rows[0];

    // STRICT BUSINESS RULE: Users can only update their own profiles, 
    // tenant_admin can update users in their tenant, super_admin can update anyone
    if (role === 'user') {
      if (userId !== requestUserId) {
        return sendError(res, 403, 'Access denied: Users can only update their own profiles');
      }
    } else if (role === 'tenant_admin') {
      // tenant_admin can only update users in their own tenant
      if (targetUser.tenant_id !== tenantId) {
        return sendError(res, 403, 'Access denied: Cannot update users from other tenants');
      }
      // tenant_admin cannot modify other tenant_admin or super_admin users
      if (targetUser.role === 'tenant_admin' || targetUser.role === 'super_admin') {
        return sendError(res, 403, 'Access denied: Cannot modify administrator accounts');
      }
    }
    // super_admin can update anyone (no additional restrictions)

    // TENANT ISOLATION: Verify the route tenant matches the user's tenant
    if (role !== 'super_admin' && routeTenantId !== targetUser.tenant_id) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'Invalid route: User does not belong to the specified tenant');
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${valueIndex++}`);
      values.push(fullName);
    }

    // Only admins can change roles and active status
    if (role === 'tenant_admin' || role === 'super_admin') {
      if (userRole !== undefined) {
        updates.push(`role = $${valueIndex++}`);
        values.push(userRole);
      }
      
      if (isActive !== undefined) {
        updates.push(`is_active = $${valueIndex++}`);
        values.push(isActive);
      }
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'No valid fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await client.query(
      `UPDATE users SET ${updates.join(', ')} 
       WHERE id = $${valueIndex} 
       RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
      values
    );

    // Log the audit trail
    await logAudit(targetUser.tenant_id, requestUserId, 'UPDATE', 'user', userId, {
      updatedFields: { fullName, userRole, isActive },
      adminRole: role
    });

    await client.query('COMMIT');

    const updatedUser = result.rows[0];
    return sendSuccess(res, 200, {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        role: updatedUser.role,
        isActive: updatedUser.is_active,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    }, 'User updated successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update user error:', error);
    return sendError(res, 500, 'Internal server error');
  } finally {
    client.release();
  }
};

const deleteUser = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { role, tenantId, userId: requestUserId } = req.user;
    const { tenantId: routeTenantId, userId } = req.params;

    // STRICT BUSINESS RULE: Only tenant_admin and super_admin can delete users
    if (role !== 'tenant_admin' && role !== 'super_admin') {
      return sendError(res, 403, 'Access denied: Only administrators can delete users');
    }

    // Get the target user first
    const userQuery = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'User not found');
    }

    const targetUser = userQuery.rows[0];

    // TENANT ISOLATION: Non-super_admin must match tenantId
    if (role !== 'super_admin' && targetUser.tenant_id !== tenantId) {
      return sendError(res, 403, 'Access denied: Cannot delete users from other tenants');
    }

    // TENANT ISOLATION: Verify the route tenant matches the user's tenant
    if (role !== 'super_admin' && routeTenantId !== targetUser.tenant_id) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'Invalid route: User does not belong to the specified tenant');
    }

    // Soft delete the user (set is_active to false)
    await client.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    // Log the audit trail
    await logAudit(targetUser.tenant_id, requestUserId, 'DELETE', 'user', userId, {
      deletedUserEmail: targetUser.email,
      adminRole: role
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, null, 'User deleted successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    return sendError(res, 500, 'Internal server error');
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
