import { useState, useEffect } from 'react';
import api from '../services/api';

export default function TaskModal({ 
  isOpen, 
  onClose, 
  onTaskCreated, 
  onTaskUpdated,
  projectId,
  task = null, // If task is provided, it's edit mode
  projectUsers = [] // List of users in the project/tenant for assignment
}) {
  const isEditMode = !!task;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    due_date: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState(projectUsers);

  // Populate form data when editing
  useEffect(() => {
    if (isEditMode && task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        assigned_to: task.assigned_to || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : '' // Convert to YYYY-MM-DD format
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to: '',
        due_date: ''
      });
    }
  }, [isEditMode, task]);

  // Fetch users for assignment if not provided
  useEffect(() => {
    if (isOpen && users.length === 0) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await api.get('/users');
      
      if (response.data && response.data.data) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }
    
    if (formData.due_date && new Date(formData.due_date) < new Date().setHours(0,0,0,0)) {
      newErrors.due_date = 'Due date cannot be in the past';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null
      };
      
      let response;
      
      if (isEditMode) {
        // Update existing task
        response = await api.put(`/tasks/${task.id}`, payload);
        
        if (onTaskUpdated) {
          onTaskUpdated(response.data.data);
        }
      } else {
        // Create new task
        response = await api.post(`/projects/${projectId}/tasks`, payload);
        
        if (onTaskCreated) {
          onTaskCreated(response.data.data);
        }
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to: '',
        due_date: ''
      });
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} task:`, error);
      
      if (error.response && error.response.data) {
        const { message } = error.response.data;
        setErrors({ general: message || `Failed to ${isEditMode ? 'update' : 'create'} task` });
      } else {
        setErrors({ general: `Failed to ${isEditMode ? 'update' : 'create'} task. Please try again.` });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to: '',
        due_date: ''
      });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px'
        }}>
          <h2 style={{ margin: 0 }}>
            {isEditMode ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#6c757d',
              padding: '0'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div style={{ 
              color: 'red', 
              marginBottom: '15px', 
              padding: '10px', 
              border: '1px solid red', 
              borderRadius: '4px',
              backgroundColor: '#ffeaea'
            }}>
              {errors.general}
            </div>
          )}

          {/* Task Title */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="title" style={{ 
              display: 'block', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Task Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: errors.title ? '2px solid red' : '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="Enter task title"
              disabled={loading}
            />
            {errors.title && (
              <span style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                {errors.title}
              </span>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="description" style={{ 
              display: 'block', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px',
                resize: 'vertical'
              }}
              placeholder="Enter task description (optional)"
              disabled={loading}
            />
          </div>

          {/* Priority and Assigned User Row */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            marginBottom: '20px'
          }}>
            {/* Priority */}
            <div>
              <label htmlFor="priority" style={{ 
                display: 'block', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Assigned User */}
            <div>
              <label htmlFor="assigned_to" style={{ 
                display: 'block', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                Assigned To
              </label>
              <select
                id="assigned_to"
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
                disabled={loading || usersLoading}
              >
                <option value="">Unassigned</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.name} ({user.email})
                  </option>
                ))}
              </select>
              {usersLoading && (
                <small style={{ color: '#6c757d' }}>Loading users...</small>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div style={{ marginBottom: '25px' }}>
            <label htmlFor="due_date" style={{ 
              display: 'block', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Due Date
            </label>
            <input
              type="date"
              id="due_date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: errors.due_date ? '2px solid red' : '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              disabled={loading}
              min={new Date().toISOString().split('T')[0]} // Prevent past dates
            />
            {errors.due_date && (
              <span style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                {errors.due_date}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'flex-end' 
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: loading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {loading 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? 'Update Task' : 'Create Task')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
