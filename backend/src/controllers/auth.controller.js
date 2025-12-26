const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');
const logAudit = require('../utils/auditLogger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const registerTenant = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { tenantName, subdomain, adminEmail, adminPassword, adminFullName } = req.body;
    
    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    // Create tenant
    const tenantId = uuidv4();
    await client.query(
      `INSERT INTO tenants (id, name, subdomain, max_users, max_projects) 
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, tenantName, subdomain, 25, 15]
    );
    
    // Create tenant admin
    const userId = uuidv4();
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, tenantId, adminEmail, passwordHash, adminFullName, 'tenant_admin']
    );
    
    await client.query('COMMIT');
    
    return sendSuccess(res, 201, {
      tenantId,
      userId
    }, 'Tenant registered successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    return sendError(res, 400, 'Registration failed');
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;
    
    // Find user by email and tenantId
    const userResult = await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.full_name, u.role, u.is_active,
              t.name as tenant_name, t.subdomain, t.status as tenant_status
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1 AND u.tenant_id = $2`,
      [email, tenantId]
    );
    
    if (userResult.rows.length === 0) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    const user = userResult.rows[0];
    
    // Check if user is active
    if (!user.is_active) {
      return sendError(res, 401, 'Account is disabled');
    }
    
    // Check if tenant is active
    if (user.tenant_status !== 'active') {
      return sendError(res, 401, 'Tenant account is suspended');
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return sendError(res, 401, 'Invalid credentials');
    }
    
    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role
    });
    
    // Log audit trail
    await logAudit(user.tenant_id, user.id, 'LOGIN', 'user', user.id, {
      userEmail: user.email,
      role: user.role
    });
    
    return sendSuccess(res, 200, {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        tenant: {
          id: user.tenant_id,
          name: user.tenant_name,
          subdomain: user.subdomain
        }
      }
    }, 'Login successful');
    
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Internal server error');
  }
};

module.exports = {
  registerTenant,
  login
};
