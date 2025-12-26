import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [projectError, setProjectError] = useState(null);
  const [tasksError, setTasksError] = useState(null);

  const fetchProject = async () => {
    try {
      setProjectLoading(true);
      const response = await api.get(`/projects/${projectId}`);
      
      if (response.data && response.data.data) {
        setProject(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
      
      if (error.response?.status === 404) {
        setProjectError('Project not found. It may have been deleted or you may not have access to it.');
      } else if (error.response?.status === 403) {
        setProjectError('You do not have permission to view this project.');
      } else {
        setProjectError('Failed to load project details.');
      }
    } finally {
      setProjectLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setTasksLoading(true);
      const response = await api.get(`/projects/${projectId}/tasks`);
      
      if (response.data && response.data.data) {
        setTasks(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setTasksError('Failed to load tasks for this project.');
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchTasks();
    }
  }, [projectId]);

  const handleBackToProjects = () => {
    navigate('/projects');
  };

  const getStatusBadgeStyle = (status) => {
    const baseStyle = {
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    };

    switch (status) {
      case 'active':
        return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
      case 'completed':
        return { ...baseStyle, backgroundColor: '#d1ecf1', color: '#0c5460' };
      case 'on_hold':
        return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
      default:
        return { ...baseStyle, backgroundColor: '#f8d7da', color: '#721c24' };
    }
  };

  const getTaskStatusBadgeStyle = (status) => {
    const baseStyle = {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    };

    switch (status) {
      case 'todo':
        return { ...baseStyle, backgroundColor: '#e9ecef', color: '#495057' };
      case 'in_progress':
        return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
      case 'completed':
        return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
      default:
        return { ...baseStyle, backgroundColor: '#f8d7da', color: '#721c24' };
    }
  };

  const getTaskPriorityBadgeStyle = (priority) => {
    const baseStyle = {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    };

    switch (priority) {
      case 'high':
        return { ...baseStyle, backgroundColor: '#f8d7da', color: '#721c24' };
      case 'medium':
        return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
      case 'low':
        return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
      default:
        return { ...baseStyle, backgroundColor: '#e9ecef', color: '#495057' };
    }
  };

  const handleStatusChange = async (taskId, currentStatus) => {
    const statusOptions = ['todo', 'in_progress', 'completed'];
    const currentIndex = statusOptions.indexOf(currentStatus);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
    
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: nextStatus });
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: nextStatus } : task
      ));
      
    } catch (error) {
      console.error('Failed to update task status:', error);
      
      let errorMessage = 'Failed to update task status';
      if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to update this task';
      } else if (error.response?.status === 404) {
        errorMessage = 'Task not found';
      }
      
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleEditTask = (task) => {
    // TODO: Open edit task modal
    alert(`Edit task functionality will be implemented next.\nTask: ${task.title}`);
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Are you sure you want to delete task "${taskTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/tasks/${taskId}`);
      
      // Remove task from local state
      setTasks(prev => prev.filter(task => task.id !== taskId));
      alert('Task deleted successfully');
      
    } catch (error) {
      console.error('Failed to delete task:', error);
      
      let errorMessage = 'Failed to delete task';
      if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to delete this task';
      } else if (error.response?.status === 404) {
        errorMessage = 'Task not found';
      }
      
      alert(`Error: ${errorMessage}`);
    }
  };

  if (projectLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh' 
      }}>
        <div>Loading project details...</div>
      </div>
    );
  }

  if (projectError) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <button
          onClick={handleBackToProjects}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          ← Back to Projects
        </button>
        
        <div style={{
          padding: '30px',
          backgroundColor: '#f8d7da',
          borderRadius: '8px',
          border: '1px solid #f5c6cb',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#721c24', marginBottom: '10px' }}>Error Loading Project</h3>
          <p style={{ color: '#721c24', margin: '0' }}>{projectError}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <button
          onClick={handleBackToProjects}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to Projects
        </button>
      </div>

      {/* Project Information */}
      {project && (
        <div style={{
          padding: '25px',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          backgroundColor: 'white',
          marginBottom: '30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '20px'
          }}>
            <h1 style={{ margin: 0, color: '#343a40' }}>
              {project.name}
            </h1>
            <span style={getStatusBadgeStyle(project.status)}>
              {project.status}
            </span>
          </div>

          {project.description && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#495057', marginBottom: '10px' }}>Description</h3>
              <p style={{ 
                color: '#6c757d', 
                lineHeight: '1.5',
                margin: '0',
                fontSize: '16px'
              }}>
                {project.description}
              </p>
            </div>
          )}

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px'
          }}>
            <div>
              <strong style={{ color: '#495057' }}>Created:</strong>
              <div style={{ color: '#6c757d' }}>
                {new Date(project.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
            <div>
              <strong style={{ color: '#495057' }}>Tasks:</strong>
              <div style={{ color: '#6c757d' }}>
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </div>
            </div>
            {project.updated_at && (
              <div>
                <strong style={{ color: '#495057' }}>Last Updated:</strong>
                <div style={{ color: '#6c757d' }}>
                  {new Date(project.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Section */}
      <div style={{
        padding: '25px',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#343a40' }}>
          Tasks ({tasks.length})
        </h2>

        {tasksLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div>Loading tasks...</div>
          </div>
        ) : tasksError ? (
          <div style={{
            padding: '20px',
            backgroundColor: '#f8d7da',
            borderRadius: '6px',
            border: '1px solid #f5c6cb',
            textAlign: 'center'
          }}>
            <p style={{ color: '#721c24', margin: '0' }}>{tasksError}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{ color: '#6c757d', marginBottom: '10px' }}>No Tasks Found</h4>
            <p style={{ color: '#6c757d', margin: '0' }}>
              This project doesn't have any tasks yet.
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '20px'
          }}>
            {tasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '20px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#fafafa',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {/* Task Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '15px'
                }}>
                  <h4 style={{ margin: 0, color: '#343a40', fontSize: '18px' }}>
                    {task.title}
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={getTaskStatusBadgeStyle(task.status)}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.priority && (
                      <span style={getTaskPriorityBadgeStyle(task.priority)}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Task Description */}
                {task.description && (
                  <p style={{ 
                    color: '#6c757d', 
                    margin: '0 0 15px 0',
                    lineHeight: '1.5',
                    fontSize: '14px'
                  }}>
                    {task.description}
                  </p>
                )}

                {/* Task Details Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px',
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <div>
                    <strong style={{ color: '#495057', fontSize: '12px' }}>ASSIGNED TO:</strong>
                    <div style={{ color: '#6c757d', fontSize: '14px' }}>
                      {task.assigned_to_name || 'Unassigned'}
                    </div>
                  </div>
                  
                  <div>
                    <strong style={{ color: '#495057', fontSize: '12px' }}>DUE DATE:</strong>
                    <div style={{ 
                      color: task.due_date && new Date(task.due_date) < new Date() ? '#dc3545' : '#6c757d',
                      fontSize: '14px'
                    }}>
                      {task.due_date 
                        ? new Date(task.due_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'No due date'
                      }
                      {task.due_date && new Date(task.due_date) < new Date() && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 'bold' }}>
                          (OVERDUE)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <strong style={{ color: '#495057', fontSize: '12px' }}>CREATED:</strong>
                    <div style={{ color: '#6c757d', fontSize: '14px' }}>
                      {new Date(task.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                {/* Task Actions */}
                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  {/* Status Change Button */}
                  <button
                    onClick={() => handleStatusChange(task.id, task.status)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    title={`Change status from ${task.status.replace('_', ' ')} to ${
                      task.status === 'todo' ? 'in progress' : 
                      task.status === 'in_progress' ? 'completed' : 'todo'
                    }`}
                  >
                    {task.status === 'todo' ? '→ Start' : 
                     task.status === 'in_progress' ? '→ Complete' : '→ Reopen'}
                  </button>
                  
                  {/* Edit Button */}
                  <button
                    onClick={() => handleEditTask(task)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Edit
                  </button>
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteTask(task.id, task.title)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
