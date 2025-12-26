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

const createProject = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // BUSINESS RULE: tenantId comes only from JWT
    const { role, tenantId, userId } = req.user;
    const { name, description, priority = 'medium', status = 'active' } = req.body;

    // Basic validation
    if (!name || name.trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }

    // BUSINESS RULE: Check max_projects before creating project
    const tenantQuery = await client.query(
      'SELECT max_projects FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const maxProjects = tenantQuery.rows[0].max_projects;

    // Check current project count against limit
    const projectCountQuery = await client.query(
      'SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1',
      [tenantId]
    );

    const currentProjectCount = parseInt(projectCountQuery.rows[0].count);

    if (currentProjectCount >= maxProjects) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot create project: Limit reached (${maxProjects} projects maximum)`
      });
    }

    // Check if project name already exists in this tenant
    const existingProject = await client.query(
      'SELECT id FROM projects WHERE name = $1 AND tenant_id = $2',
      [name.trim(), tenantId]
    );

    if (existingProject.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Project name already exists in this tenant'
      });
    }

    const projectId = uuidv4();

    // Create project
    const result = await client.query(
      `INSERT INTO projects (id, tenant_id, name, description, priority, status, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, description, priority, status, created_at, created_by`,
      [projectId, tenantId, name.trim(), description, priority, status, userId]
    );

    // BUSINESS RULE: Log all actions in audit_logs
    await logAuditEvent(
      client, userId, tenantId, 'create_project', 'project', projectId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const listProjects = async (req, res) => {
  try {
    // BUSINESS RULE: tenantId comes only from JWT
    const { role, tenantId, userId } = req.user;
    const { status, priority, createdBy, search, page = 1, limit = 10 } = req.query;

    const client = await pool.connect();

    try {
      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
      const offset = (pageNum - 1) * limitNum;

      // BUSINESS RULE: Filter always by tenant_id
      let query = `
        SELECT p.id, p.name, p.description, p.priority, p.status, p.created_at, p.updated_at,
               u.full_name as created_by_name, u.email as created_by_email,
               (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.tenant_id = $1
      `;
      
      const values = [tenantId];
      let paramCount = 2;

      // Add filters
      if (status) {
        query += ` AND p.status = $${paramCount++}`;
        values.push(status);
      }

      if (priority) {
        query += ` AND p.priority = $${paramCount++}`;
        values.push(priority);
      }

      if (createdBy) {
        query += ` AND p.created_by = $${paramCount++}`;
        values.push(createdBy);
      }

      // Add search by name filter
      if (search) {
        query += ` AND p.name ILIKE $${paramCount++}`;
        values.push(`%${search}%`);
      }

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM projects p
        WHERE p.tenant_id = $1
      `;
      
      const countValues = [tenantId];
      let countParamCount = 2;

      // Apply same filters to count query
      if (status) {
        countQuery += ` AND p.status = $${countParamCount++}`;
        countValues.push(status);
      }

      if (priority) {
        countQuery += ` AND p.priority = $${countParamCount++}`;
        countValues.push(priority);
      }

      if (createdBy) {
        countQuery += ` AND p.created_by = $${countParamCount++}`;
        countValues.push(createdBy);
      }

      if (search) {
        countQuery += ` AND p.name ILIKE $${countParamCount++}`;
        countValues.push(`%${search}%`);
      }

      // Execute count query
      const countResult = await client.query(countQuery, countValues);
      const totalItems = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalItems / limitNum);

      // Add sorting and pagination to main query
      query += ` ORDER BY p.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      values.push(limitNum, offset);

      const result = await client.query(query, values);

      // BUSINESS RULE: Log all actions in audit_logs
      await logAuditEvent(
        client, userId, tenantId, 'list_projects', 'project', null,
        req.ip || req.connection.remoteAddress
      );

      res.status(200).json({
        success: true,
        data: result.rows,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: totalItems,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        },
        filters: {
          status: status || null,
          priority: priority || null,
          createdBy: createdBy || null,
          search: search || null
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list projects',
      error: error.message
    });
  }
};

const updateProject = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { projectId } = req.params;
    // BUSINESS RULE: tenantId comes only from JWT
    const { role, tenantId, userId } = req.user;
    const { name, description, priority, status } = req.body;

    // Get project to verify tenant access and ownership
    // BUSINESS RULE: Filter always by tenant_id
    const projectQuery = await client.query(
      'SELECT tenant_id, created_by, name as current_name FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectQuery.rows[0];

    // BUSINESS RULE: Authorization - tenant_admin → full access, Project creator → can update/delete own project
    if (role !== 'tenant_admin' && project.created_by !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only project creator or tenant administrator can update projects'
      });
    }

    // If updating name, check for duplicates within tenant
    if (name && name.trim() !== project.current_name) {
      const existingProject = await client.query(
        'SELECT id FROM projects WHERE name = $1 AND tenant_id = $2 AND id != $3',
        [name.trim(), tenantId, projectId]
      );

      if (existingProject.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Project name already exists in this tenant'
        });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name && name.trim() !== '') {
      updates.push(`name = $${paramCount++}`);
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (priority) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }

    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
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
    values.push(projectId);

    const query = `
      UPDATE projects 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING id, name, description, priority, status, created_at, updated_at
    `;
    
    values.push(tenantId); // Add tenantId for WHERE clause

    const result = await client.query(query, values);

    // BUSINESS RULE: Log all actions in audit_logs
    const updateDetails = Object.keys(req.body).join(', ');
    await logAuditEvent(
      client, userId, tenantId, `update_project: ${updateDetails}`, 'project', projectId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const deleteProject = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { projectId } = req.params;
    // BUSINESS RULE: tenantId comes only from JWT
    const { role, tenantId, userId } = req.user;

    // Get project to verify tenant access and ownership
    // BUSINESS RULE: Filter always by tenant_id
    const projectQuery = await client.query(
      'SELECT tenant_id, created_by, name FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectQuery.rows[0];

    // BUSINESS RULE: Authorization - tenant_admin → full access, Project creator → can update/delete own project
    if (role !== 'tenant_admin' && project.created_by !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only project creator or tenant administrator can delete projects'
      });
    }

    // Check if project has tasks
    const taskCount = await client.query(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = $1',
      [projectId]
    );

    if (parseInt(taskCount.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot delete project with existing tasks. Please delete all tasks first.'
      });
    }

    // Delete project (ensure tenant_id filter)
    await client.query(
      'DELETE FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    // BUSINESS RULE: Log all actions in audit_logs
    await logAuditEvent(
      client, userId, tenantId, `delete_project: ${project.name}`, 'project', projectId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createProject,
  listProjects,
  updateProject,
  deleteProject
};
