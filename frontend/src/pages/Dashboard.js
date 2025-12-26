import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        const response = await api.get('/auth/me');
        
        if (response.data && response.data.data) {
          setUserDetails(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch user details:', error);
        setError('Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{
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

  const displayUser = userDetails || user;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h1>Dashboard</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {/* User Information */}
      <div style={{
        padding: '20px',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        backgroundColor: 'white'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#343a40' }}>User Information</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Name: </strong>
          <span>{displayUser?.full_name || displayUser?.name || 'N/A'}</span>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Email: </strong>
          <span>{displayUser?.email || 'N/A'}</span>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Role: </strong>
          <span>{displayUser?.role || 'N/A'}</span>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Tenant: </strong>
          <span>{displayUser?.tenant?.name || displayUser?.tenant_name || 'N/A'}</span>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Tenant Subdomain: </strong>
          <span>{displayUser?.tenant?.subdomain || displayUser?.tenant_subdomain || 'N/A'}</span>
        </div>
      </div>

      {/* Welcome Message */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#e7f3ff',
        borderRadius: '8px',
        border: '1px solid #b3d7ff'
      }}>
        <h3 style={{ color: '#0066cc', marginBottom: '10px' }}>
          Welcome to your {displayUser?.tenant?.name || 'organization'} dashboard!
        </h3>
        <p style={{ margin: '0', color: '#004499' }}>
          You're logged in as <strong>{displayUser?.full_name || displayUser?.name}</strong> with <strong>{displayUser?.role}</strong> privileges.
        </p>
      </div>
    </div>
  );
}
