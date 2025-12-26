import { useState } from 'react';
import api from '../services/api';

export default function ProjectModal({ isOpen, onClose, onProjectCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (!formData.status) {
      newErrors.status = 'Status is required';
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
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: formData.status
      };
      
      const response = await api.post('/projects', payload);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        status: 'active'
      });
      
      // Call callback to refresh project list
      if (onProjectCreated) {
        onProjectCreated(response.data.data);
      }
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Failed to create project:', error);
      
      if (error.response && error.response.data) {
        const { message } = error.response.data;
        setErrors({ general: message || 'Failed to create project' });
      } else {
        setErrors({ general: 'Failed to create project. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setFormData({
        name: '',
        description: '',
        status: 'active'
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
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0 }}>Create New Project</h2>
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

          {/* Project Name */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="name" style={{ 
              display: 'block', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Project Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: errors.name ? '2px solid red' : '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="Enter project name"
              disabled={loading}
            />
            {errors.name && (
              <span style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                {errors.name}
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
              placeholder="Enter project description (optional)"
              disabled={loading}
            />
          </div>

          {/* Status */}
          <div style={{ marginBottom: '25px' }}>
            <label htmlFor="status" style={{ 
              display: 'block', 
              marginBottom: '5px',
              fontWeight: 'bold'
            }}>
              Status *
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              style={{ 
                width: '100%', 
                padding: '10px', 
                border: errors.status ? '2px solid red' : '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              disabled={loading}
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
            {errors.status && (
              <span style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                {errors.status}
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
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
