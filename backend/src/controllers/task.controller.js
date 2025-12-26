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
      return res.status(400).json({
        success: false,
        message: 'Project ID and task title are required'
      });
    }

    // CRITICAL BUSINESS RULE: Get tenant_id from project, NOT from JWT
    const projectQuery = await client.query(
      'SELECT tenant_id, created_by FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = projectQuery.rows[0];
    const projectTenantId = project.tenant_id; // Use project's tenant_id, NOT JWT tenantId

    // CRITICAL BUSINESS RULE: Verify project belongs to user's tenant
    if (projectTenantId !== userTenantId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Project does not belong to your tenant'
      });
    }

    // CRITICAL BUSINESS RULE: Verify assignedTo user belongs to same tenant (if provided)
    if (assignedTo) {
      const assigneeQuery = await client.query(
        'SELECT tenant_id FROM users WHERE id = $1',
        [assignedTo]
      );

      if (assigneeQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found'
        });
      }

      if (assigneeQuery.rows[0].tenant_id !== projectTenantId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Access denied: Cannot assign task to user from different tenant'
        });
      }
    }

    const taskId = uuidv4();

    // Create task using project's tenant_id
    const result = await client.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, project_id, title, description, status, priority, assigned_to, created_at, created_by`,
      [taskId, projectId, title.trim(), description, status, priority, assignedTo, userId]
    );

    // CRITICAL BUSINESS RULE: Log all CREATE actions in audit_logs
    await logAuditEvent(
      client, userId, projectTenantId, 'create_task', 'task', taskId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const listProjectTasks = async (req, res) => {
  try {
    const { role, tenantId: userTenantId, userId } = req.user;
    const { projectId } = req.params;
    const { status, priority, assignedTo, search, page = 1, limit = 10, sortBy = 'default' } = req.query;

    // Verify project belongs to user's tenant
    const client = await pool.connect();

    try {
      const projectQuery = await client.query(
        'SELECT tenant_id FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      const projectTenantId = projectQuery.rows[0].tenant_id;

      if (projectTenantId !== userTenantId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Project does not belong to your tenant'
        });
      }

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // Build query for tasks with enhanced filtering
      let query = `
        SELECT t.id, t.project_id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.updated_at,
               creator.full_name as created_by_name, creator.email as created_by_email,
               assignee.full_name as assigned_to_name, assignee.email as assigned_to_email,
               p.name as project_name,
               CASE 
                 WHEN t.priority = 'high' THEN 3
                 WHEN t.priority = 'medium' THEN 2
                 WHEN t.priority = 'low' THEN 1
                 ELSE 0
               END as priority_order
        FROM tasks t
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.project_id = $1
      `;
      
      const values = [projectId];
      let paramCount = 2;

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

      // Enhanced search (title only as requested)
      if (search) {
        query += ` AND t.title ILIKE $${paramCount++}`;
        values.push(`%${search}%`);
      }

      // Get total count with same filters
      let countQuery = `
        SELECT COUNT(*) as total
        FROM tasks t
        WHERE t.project_id = $1
      `;
      
      const countValues = [projectId];
      let countParamCount = 2;

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

      // Add sorting - priority DESC, due_date ASC as requested
      let orderClause = '';
      switch (sortBy) {
        case 'priority':
          orderClause = 'ORDER BY priority_order DESC, t.due_date ASC NULLS LAST, t.created_at DESC';
          break;
        case 'due_date':
          orderClause = 'ORDER BY t.due_date ASC NULLS LAST, priority_order DESC, t.created_at DESC';
          break;
        case 'created':
          orderClause = 'ORDER BY t.created_at DESC';
          break;
        case 'updated':
          orderClause = 'ORDER BY t.updated_at DESC';
          break;
        case 'title':
          orderClause = 'ORDER BY t.title ASC';
          break;
        case 'status':
          orderClause = 'ORDER BY t.status ASC, priority_order DESC, t.due_date ASC NULLS LAST';
          break;
        case 'default':
        default:
          // Default order: priority DESC, due_date ASC
          orderClause = 'ORDER BY priority_order DESC, t.due_date ASC NULLS LAST, t.created_at DESC';
          break;
      }

      query += ` ${orderClause} LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      values.push(limitNum, offset);

      const result = await client.query(query, values);

      // Log audit event
      await logAuditEvent(
        client, userId, projectTenantId, 'list_tasks', 'task', null,
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
          assignedTo: assignedTo || null,
          search: search || null
        },
        sorting: {
          sortBy: sortBy,
          availableOptions: ['default', 'priority', 'due_date', 'created', 'updated', 'title', 'status']
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list tasks',
      error: error.message
    });
  }
};

const updateTaskStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { taskId } = req.params;
    const { role, tenantId: userTenantId, userId } = req.user;
    const { status } = req.body;

    if (!status) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Get task and verify tenant through project
    const taskQuery = await client.query(
      `SELECT t.id, t.project_id, p.tenant_id, t.title
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const task = taskQuery.rows[0];
    const taskTenantId = task.tenant_id;

    // Verify task belongs to user's tenant
    if (taskTenantId !== userTenantId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Task does not belong to your tenant'
      });
    }

    // CRITICAL BUSINESS RULE: Any tenant user can update task status
    // No additional authorization checks needed beyond tenant verification

    // Update task status
    const result = await client.query(
      `UPDATE tasks 
       SET status = $1, updated_at = $2 
       WHERE id = $3
       RETURNING id, project_id, title, description, status, priority, assigned_to, created_at, updated_at`,
      [status, new Date(), taskId]
    );

    // CRITICAL BUSINESS RULE: Log all UPDATE actions in audit_logs
    await logAuditEvent(
      client, userId, taskTenantId, `update_task_status: ${status}`, 'task', taskId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update task status',
      error: error.message
    });
  } finally {
    client.release();
  }
};

const updateTask = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { taskId } = req.params;
    const { role, tenantId: userTenantId, userId } = req.user;
    const { title, description, priority, status, assignedTo } = req.body;

    // Get task and verify tenant through project
    const taskQuery = await client.query(
      `SELECT t.id, t.project_id, t.created_by, p.tenant_id, t.title
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const task = taskQuery.rows[0];
    const taskTenantId = task.tenant_id;

    // Verify task belongs to user's tenant
    if (taskTenantId !== userTenantId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Task does not belong to your tenant'
      });
    }

    // Authorization: task creator, tenant_admin, or any user can update (more permissive than projects)
    // Any authenticated user in the tenant can update tasks

    // If assignedTo is being updated, verify the user belongs to same tenant
    if (assignedTo) {
      const assigneeQuery = await client.query(
        'SELECT tenant_id FROM users WHERE id = $1',
        [assignedTo]
      );

      if (assigneeQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found'
        });
      }

      if (assigneeQuery.rows[0].tenant_id !== taskTenantId) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Access denied: Cannot assign task to user from different tenant'
        });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title && title.trim() !== '') {
      updates.push(`title = $${paramCount++}`);
      values.push(title.trim());
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

    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assignedTo);
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
    values.push(taskId);

    const query = `
      UPDATE tasks 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, project_id, title, description, status, priority, assigned_to, created_at, updated_at
    `;

    const result = await client.query(query, values);

    // CRITICAL BUSINESS RULE: Log all UPDATE actions in audit_logs
    const updateDetails = Object.keys(req.body).join(', ');
    await logAuditEvent(
      client, userId, taskTenantId, `update_task: ${updateDetails}`, 'task', taskId,
      req.ip || req.connection.remoteAddress
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createTask,
  listProjectTasks,
  updateTaskStatus,
  updateTask
};
