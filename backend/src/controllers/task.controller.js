const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logAudit = require('../utils/auditLogger');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const createTask = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // CRITICAL: Get tenantId from JWT for verification ONLY
    const { role, tenantId: userTenantId, userId } = req.user;
    const { projectId } = req.params;
    const { title, description, priority = 'medium', status = 'todo', assignedTo } = req.body;

    // Basic validation
    if (!projectId || !title || title.trim() === '') {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'Project ID and task title are required');
    }

    // CRITICAL BUSINESS RULE: Get tenant_id from project, NOT from JWT
    const projectQuery = await client.query(
      'SELECT tenant_id, created_by FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Project not found');
    }

    const project = projectQuery.rows[0];
    const effectiveTenantId = project.tenant_id; // Use project's tenant_id

    // CRITICAL SECURITY: Verify that user's JWT tenant matches project tenant
    if (userTenantId !== effectiveTenantId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Cannot create tasks in projects from other tenants');
    }

    // Validate assignedTo user exists and belongs to same tenant
    if (assignedTo) {
      const assigneeQuery = await client.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [assignedTo, effectiveTenantId]
      );

      if (assigneeQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendError(res, 400, 'Assigned user not found or not active in this tenant');
      }
    }

    const taskId = uuidv4();

    // Create task with tenant_id inherited from project
    const result = await client.query(
      `INSERT INTO tasks (id, project_id, tenant_id, title, description, priority, status, assigned_to, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, priority, status, assigned_to, created_at, created_by`,
      [taskId, projectId, effectiveTenantId, title.trim(), description, priority, status, assignedTo, userId]
    );

    // Log audit trail using project's tenant_id
    await logAudit(effectiveTenantId, userId, 'CREATE', 'task', taskId, {
      taskTitle: title.trim(),
      projectId,
      priority,
      status,
      assignedTo
    });

    await client.query('COMMIT');

    return sendSuccess(res, 201, {
      task: result.rows[0]
    }, 'Task created successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create task error:', error);
    return sendError(res, 500, 'Failed to create task');
  } finally {
    client.release();
  }
};

const listProjectTasks = async (req, res) => {
  try {
    // CRITICAL: Get tenantId from JWT for verification ONLY
    const { role, tenantId: userTenantId, userId } = req.user;
    const { projectId } = req.params;
    const { status, priority, assignedTo, search, page = 1, limit = 10 } = req.query;

    const client = await pool.connect();

    try {
      // CRITICAL BUSINESS RULE: Get tenant_id from project, NOT from JWT
      const projectQuery = await client.query(
        'SELECT tenant_id, name FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectQuery.rows.length === 0) {
        return sendError(res, 404, 'Project not found');
      }

      const project = projectQuery.rows[0];
      const effectiveTenantId = project.tenant_id;

      // CRITICAL SECURITY: Verify that user's JWT tenant matches project tenant
      if (userTenantId !== effectiveTenantId) {
        return sendError(res, 403, 'Access denied: Cannot access tasks from projects in other tenants');
      }

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Build query with tenant_id verification
      let query = `
        SELECT t.id, t.title, t.description, t.priority, t.status, t.created_at, t.updated_at,
               u1.full_name as created_by_name, u1.email as created_by_email,
               u2.full_name as assigned_to_name, u2.email as assigned_to_email
        FROM tasks t
        LEFT JOIN users u1 ON t.created_by = u1.id
        LEFT JOIN users u2 ON t.assigned_to = u2.id
        WHERE t.project_id = $1 AND t.tenant_id = $2
      `;
      
      const values = [projectId, effectiveTenantId];
      let paramCount = 3;

      // Add filters
      if (status) {
        query += ` AND t.status = $${paramCount++}`;
        values.push(status);
      }

      if (priority) {
        query += ` AND t.priority = $${paramCount++}`;
        values.push(priority);
      }

      if (assignedTo) {
        query += ` AND t.assigned_to = $${paramCount++}`;
        values.push(assignedTo);
      }

      if (search) {
        query += ` AND t.title ILIKE $${paramCount++}`;
        values.push(`%${search}%`);
      }

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM tasks t
        WHERE t.project_id = $1 AND t.tenant_id = $2
      `;
      
      const countValues = [projectId, effectiveTenantId];
      let countParamCount = 3;

      if (status) {
        countQuery += ` AND t.status = $${countParamCount++}`;
        countValues.push(status);
      }

      if (priority) {
        countQuery += ` AND t.priority = $${countParamCount++}`;
        countValues.push(priority);
      }

      if (assignedTo) {
        countQuery += ` AND t.assigned_to = $${countParamCount++}`;
        countValues.push(assignedTo);
      }

      if (search) {
        countQuery += ` AND t.title ILIKE $${countParamCount++}`;
        countValues.push(`%${search}%`);
      }

      const countResult = await client.query(countQuery, countValues);
      const totalItems = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalItems / limitNum);

      // Add sorting and pagination
      query += ` ORDER BY t.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      values.push(limitNum, offset);

      const result = await client.query(query, values);

      // Log audit trail
      await logAudit(effectiveTenantId, userId, 'READ', 'task_list', null, {
        projectId,
        filters: { status, priority, assignedTo, search },
        taskCount: result.rows.length
      });

      return sendSuccess(res, 200, {
        tasks: result.rows,
        project: {
          id: projectId,
          name: project.name
        },
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
          assignedTo: assignedTo || null,
          search: search || null
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('List tasks error:', error);
    return sendError(res, 500, 'Failed to list tasks');
  }
};

const updateTaskStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // CRITICAL: Get tenantId from JWT for verification ONLY
    const { role, tenantId: userTenantId, userId } = req.user;
    const { projectId, taskId } = req.params;
    const { status } = req.body;

    if (!status) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'Status is required');
    }

    // CRITICAL BUSINESS RULE: Get tenant_id from project, NOT from JWT
    const projectQuery = await client.query(
      'SELECT tenant_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Project not found');
    }

    const effectiveTenantId = projectQuery.rows[0].tenant_id;

    // CRITICAL SECURITY: Verify that user's JWT tenant matches project tenant
    if (userTenantId !== effectiveTenantId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Cannot update tasks in projects from other tenants');
    }

    // Get task to verify it belongs to the project and tenant
    const taskQuery = await client.query(
      'SELECT id, title, status as current_status, assigned_to FROM tasks WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [taskId, projectId, effectiveTenantId]
    );

    if (taskQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Task not found in this project');
    }

    const task = taskQuery.rows[0];

    // BUSINESS RULE: Only assigned user, task creator, or tenant_admin can update task status
    if (role !== 'tenant_admin' && task.assigned_to !== userId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Only assigned user or tenant administrator can update task status');
    }

    // Update task status
    const result = await client.query(
      `UPDATE tasks 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND project_id = $3 AND tenant_id = $4
       RETURNING id, title, description, priority, status, assigned_to, created_at, updated_at`,
      [status, taskId, projectId, effectiveTenantId]
    );

    // Log audit trail
    await logAudit(effectiveTenantId, userId, 'UPDATE', 'task_status', taskId, {
      taskTitle: task.title,
      oldStatus: task.current_status,
      newStatus: status,
      projectId
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, {
      task: result.rows[0]
    }, 'Task status updated successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update task status error:', error);
    return sendError(res, 500, 'Failed to update task status');
  } finally {
    client.release();
  }
};

const updateTask = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // CRITICAL: Get tenantId from JWT for verification ONLY
    const { role, tenantId: userTenantId, userId } = req.user;
    const { projectId, taskId } = req.params;
    const { title, description, priority, status, assignedTo } = req.body;

    // CRITICAL BUSINESS RULE: Get tenant_id from project, NOT from JWT
    const projectQuery = await client.query(
      'SELECT tenant_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Project not found');
    }

    const effectiveTenantId = projectQuery.rows[0].tenant_id;

    // CRITICAL SECURITY: Verify that user's JWT tenant matches project tenant
    if (userTenantId !== effectiveTenantId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Cannot update tasks in projects from other tenants');
    }

    // Get task to verify it belongs to the project and tenant
    const taskQuery = await client.query(
      'SELECT id, title, created_by, assigned_to FROM tasks WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [taskId, projectId, effectiveTenantId]
    );

    if (taskQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Task not found in this project');
    }

    const task = taskQuery.rows[0];

    // BUSINESS RULE: Only task creator, assigned user, or tenant_admin can update task
    if (role !== 'tenant_admin' && task.created_by !== userId && task.assigned_to !== userId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Only task creator, assigned user, or tenant administrator can update tasks');
    }

    // Validate assignedTo user if provided
    if (assignedTo) {
      const assigneeQuery = await client.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true',
        [assignedTo, effectiveTenantId]
      );

      if (assigneeQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendError(res, 400, 'Assigned user not found or not active in this tenant');
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined && title.trim() !== '') {
      updates.push(`title = $${paramCount++}`);
      values.push(title.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assignedTo);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 400, 'No valid fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(taskId, projectId, effectiveTenantId);

    const query = `
      UPDATE tasks 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount} AND project_id = $${paramCount + 1} AND tenant_id = $${paramCount + 2}
      RETURNING id, title, description, priority, status, assigned_to, created_at, updated_at
    `;

    const result = await client.query(query, values);

    // Log audit trail
    await logAudit(effectiveTenantId, userId, 'UPDATE', 'task', taskId, {
      taskTitle: task.title,
      updatedFields: { title, description, priority, status, assignedTo },
      projectId
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, {
      task: result.rows[0]
    }, 'Task updated successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update task error:', error);
    return sendError(res, 500, 'Failed to update task');
  } finally {
    client.release();
  }
};

const deleteTask = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // CRITICAL: Get tenantId from JWT for verification ONLY
    const { role, tenantId: userTenantId, userId } = req.user;
    const { projectId, taskId } = req.params;

    // CRITICAL BUSINESS RULE: Get tenant_id from project, NOT from JWT
    const projectQuery = await client.query(
      'SELECT tenant_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Project not found');
    }

    const effectiveTenantId = projectQuery.rows[0].tenant_id;

    // CRITICAL SECURITY: Verify that user's JWT tenant matches project tenant
    if (userTenantId !== effectiveTenantId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Cannot delete tasks in projects from other tenants');
    }

    // Get task to verify it belongs to the project and tenant
    const taskQuery = await client.query(
      'SELECT id, title, created_by FROM tasks WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [taskId, projectId, effectiveTenantId]
    );

    if (taskQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 404, 'Task not found in this project');
    }

    const task = taskQuery.rows[0];

    // BUSINESS RULE: Only task creator or tenant_admin can delete task
    if (role !== 'tenant_admin' && task.created_by !== userId) {
      await client.query('ROLLBACK');
      return sendError(res, 403, 'Access denied: Only task creator or tenant administrator can delete tasks');
    }

    // Delete task
    await client.query(
      'DELETE FROM tasks WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [taskId, projectId, effectiveTenantId]
    );

    // Log audit trail
    await logAudit(effectiveTenantId, userId, 'DELETE', 'task', taskId, {
      deletedTaskTitle: task.title,
      projectId
    });

    await client.query('COMMIT');

    return sendSuccess(res, 200, null, 'Task deleted successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete task error:', error);
    return sendError(res, 500, 'Failed to delete task');
  } finally {
    client.release();
  }
};

module.exports = {
  createTask,
  listProjectTasks,
  updateTaskStatus,
  updateTask,
  deleteTask
};
