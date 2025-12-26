import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ProjectModal from '../components/ProjectModal';

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/projects');
      
      if (response.data && response.data.data) {
        setProjects(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const canCreateProject = () => {
    return user?.role === 'tenant_admin';
  };

  const canDeleteProject = (project) => {
    return user?.role === 'tenant_admin' || project.created_by === user?.id;
  };

  const handleCreateProject = () => {
    setShowCreateModal(true);
  };

  const handleProjectCreated = (newProject) => {
    // Add new project to the list
    setProjects(prev => [newProject, ...prev]);
    alert('Project created successfully!');
  };

  const handleDeleteProject = async (projectId, projectName) => {
    // Enhanced confirmation popup with more details
    const confirmMessage = `⚠️ DELETE PROJECT CONFIRMATION ⚠️\n\n` +
      `Project: "${projectName}"\n` +
      `This action will permanently delete the project and all its tasks.\n\n` +
      `This action cannot be undone.\n\n` +
      `Are you sure you want to continue?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeleteLoading(prev => ({ ...prev, [projectId]: true }));
      
      await api.delete(`/projects/${projectId}`);
      
      // Remove project from state
      setProjects(prev => prev.filter(project => project.id !== projectId));
      
      alert('✅ Project deleted successfully');
      
    } catch (error) {
      console.error('Failed to delete project:', error);
      
      let errorMessage = 'Failed to delete project';
      
      if (error.response) {
        const { status, data } = error.response;
        
        switch (status) {
          case 403:
            errorMessage = '🔒 Access Denied: You do not have permission to delete this project. Only tenant administrators or the project creator can delete projects.';
            break;
          case 404:
            errorMessage = '❌ Project Not Found: This project may have been already deleted or does not exist.';
            // Remove from local state if 404 (project doesn't exist)
            setProjects(prev => prev.filter(project => project.id !== projectId));
            break;
          case 409:
            errorMessage = '⚠️ Cannot Delete: This project may have active tasks or dependencies. Please remove all tasks first.';
            break;
          case 500:
            errorMessage = '🚨 Server Error: There was an internal server error. Please try again later or contact support.';
            break;
          default:
            errorMessage = data?.message || `❌ Error ${status}: Failed to delete project`;
        }
      } else if (error.request) {
        errorMessage = '🌐 Network Error: Unable to connect to the server. Please check your internet connection and try again.';
      } else {
        errorMessage = '❓ Unexpected Error: Something went wrong. Please try again.';
      }
      
      alert(`Delete Failed\n\n${errorMessage}`);
      
    } finally {
      setDeleteLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh' 
      }}>
        <div>Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        flexDirection: 'column'
      }}>
        <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
        <button onClick={fetchProjects} style={{
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Retry
        </button>
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
        <h1 style={{ margin: 0 }}>Projects</h1>
        {canCreateProject() && (
          <button
            onClick={handleCreateProject}
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Create Project
          </button>
        )}
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ color: '#6c757d', marginBottom: '10px' }}>No Projects Found</h3>
          <p style={{ color: '#6c757d', margin: '0' }}>
            {canCreateProject() 
              ? 'Get started by creating your first project.' 
              : 'No projects have been created yet.'}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gap: '20px',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
        }}>
          {projects.map(project => (
            <div
              key={project.id}
              style={{
                padding: '20px',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#343a40' }}>
                {project.name}
              </h3>
              
              <div style={{ marginBottom: '10px' }}>
                <strong>Status: </strong>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: project.status === 'active' ? '#d4edda' : 
                                project.status === 'completed' ? '#d1ecf1' : '#f8d7da',
                  color: project.status === 'active' ? '#155724' : 
                         project.status === 'completed' ? '#0c5460' : '#721c24'
                }}>
                  {project.status || 'unknown'}
                </span>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <strong>Tasks: </strong>
                <span>{project.task_count || 0}</span>
              </div>
              
              {project.description && (
                <div style={{ marginBottom: '15px' }}>
                  <strong>Description: </strong>
                  <p style={{ 
                    margin: '5px 0 0 0', 
                    color: '#6c757d',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}>
                    {project.description}
                  </p>
                </div>
              )}
              
              <div style={{ marginBottom: '15px', fontSize: '12px', color: '#6c757d' }}>
                Created: {new Date(project.created_at).toLocaleDateString()}
              </div>
              
              {canDeleteProject(project) && (
                <button
                  onClick={() => handleDeleteProject(project.id, project.name)}
                  disabled={deleteLoading[project.id]}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: deleteLoading[project.id] ? '#ccc' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: deleteLoading[project.id] ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    width: '100%'
                  }}
                >
                  {deleteLoading[project.id] ? 'Deleting...' : 'Delete Project'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Project Creation Modal */}
      <ProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
