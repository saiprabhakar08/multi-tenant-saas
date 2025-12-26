const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');

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
    
    res.status(201).json({
      success: true,
      message: 'Tenant registered successfully',
      tenantId,
      userId
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  try {
    const { email, password, subdomain } = req.body;
    
    // Validate tenant by subdomain
    const tenantQuery = await pool.query(
      'SELECT id FROM tenants WHERE subdomain = $1 AND status = $2',
      [subdomain, 'active']
    );
    
    if (tenantQuery.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid tenant'
      });
    }
    
    const tenantId = tenantQuery.rows[0].id;
    
    // Validate user
    const userQuery = await pool.query(
      `SELECT id, password_hash, role, full_name 
       FROM users 
       WHERE email = $1 AND tenant_id = $2 AND is_active = true`,
      [email, tenantId]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const user = userQuery.rows[0];
    
    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT
    const token = generateToken({
      userId: user.id,
      tenantId: tenantId,
      role: user.role
    });
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email,
        fullName: user.full_name,
        role: user.role,
        tenantId
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

const me = async (req, res) => {
  // TODO: Implement get current user
};

const logout = async (req, res) => {
  // TODO: Implement user logout
};

module.exports = {
  registerTenant,
  login,
  me,
  logout
};
