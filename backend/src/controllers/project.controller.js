const { pool } = require('../config/db');
const { randomUUID } = require('crypto');
const logAudit = require('../utils/auditLogger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

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
      return sendError(res, 400, 'Project name is required');
    }

    // BUSINESS RULE: Check max_projects before creating project
    const tenantQuery = await client.query(
      'SELECT max_projects FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Tenant not found');
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
      return sendError(res, 400, `Cannot create project: Limit reached (${maxProjects} projects maximum)`);
    }

    // Check if project name already exists in this tenant
    const existingProject = await client.query(
      'SELECT id FROM projects WHERE name = $1 AND tenant_id = $2',
      [name.trim(), tenantId]
    );

    if (existingProject.rows.length > 0) {
      await client.query('ROLLBACK');
      return sendError(res, 409, 'Project name already exists in this tenant');
    }

    const projectId = randomUUID();

    // Create project
    const result = await client.query(
      `INSERT INTO projects (id, tenant_id, name, description, priority, status, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, description, priority, status, created_at, created_by`,
      [projectId, tenantId, name.trim(), description, priority, status, userId]
    );

    // Log audit trail
    await logAudit(tenantId, userId, 'CREATE', 'project', projectId, {
      projectName: name.trim(),
      priority,
      status
    });

    await client.query('COMMIT');

    return sendSuccess(res, 201, {
      project: result.rows[0]
    }, 'Project created successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create project error:', error);
    return sendError(res, 500, 'Failed to create project');
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

      // Log audit trail
      await logAudit(tenantId, userId, 'READ', 'project_list', null, {
        filters: { status, priority, createdBy, search },
        projectCount: result.rows.length
      });

      return sendSuccess(res, 200, {
        projects: result.rows,
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
    console.error('List projects error:', error);
    return sendError(res, 500, 'Failed to list projects');
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
      return sendError(res, 404, 'Project not found');
    }

    const project = projectQuery.rows[0];

    // BUSINESS RULE: Authorization - tenant_admin → full access, Project creator → can update/delete own project
    if (role !== 'tenant_admin' && project.created_by !== userId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Only project creator or tenant administrator can update projects');
    }

    // If updating name, check for duplicates within tenant
    if (name && name.trim() !== project.current_name) {
      const existingProject = await client.query(
        'SELECT id FROM projects WHERE name = $1 AND tenant_id = $2 AND id != $3',
        [name.trim(), tenantId, projectId]
      );

      if (existingProject.rows.length > 0) {
        await client.query('ROLLBACK');
        return sendError(res, 409, 'Project name already exists in this tenant');
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
      return sendError(res, 400, 'No valid fields to update');
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

    // Log audit trail
    await logAudit(tenantId, userId, 'UPDATE', 'project', projectId, {
      updatedFields: { name, description, priority, status }
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, {
      project: result.rows[0]
    }, 'Project updated successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update project error:', error);
    return sendError(res, 500, 'Failed to update project');
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
      return sendError(res, 404, 'Project not found');
    }

    const project = projectQuery.rows[0];

    // BUSINESS RULE: Authorization - tenant_admin → full access, Project creator → can update/delete own project
    if (role !== 'tenant_admin' && project.created_by !== userId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Only project creator or tenant administrator can delete projects');
    }

    // Check if project has tasks
    const taskCount = await client.query(
      'SELECT COUNT(*) as count FROM tasks WHERE project_id = $1',
      [projectId]
    );

    if (parseInt(taskCount.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'Cannot delete project with existing tasks. Please delete all tasks first.');
    }

    // Delete project (ensure tenant_id filter)
    await client.query(
      'DELETE FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    // Log audit trail
    await logAudit(tenantId, userId, 'DELETE', 'project', projectId, {
      deletedProjectName: project.name
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, null, 'Project deleted successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete project error:', error);
    return sendError(res, 500, 'Failed to delete project');
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
