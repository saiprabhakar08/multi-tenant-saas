import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import UserModal from '../components/UserModal';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState({});

  // Check if user has permission to view this page
  const canAccessUsers = () => {
    return user?.role === 'tenant_admin';
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tenants/${user.tenant_id}/users`);
      
      if (response.data && response.data.data) {
        setUsers(response.data.data);
      } else {
        setUsers(response.data || []);
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleUserSaved = (savedUser) => {
    if (editingUser) {
      // Update existing user
      setUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
    } else {
      // Add new user
      setUsers(prev => [...prev, savedUser]);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    // Prevent self-deletion
    if (userId === user.id) {
      alert('❌ Cannot delete your own account');
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to delete user: ${userEmail}?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeleteLoading(prev => ({ ...prev, [userId]: true }));
      
      // Call DELETE /api/users/:userId
      await api.delete(`/users/${userId}`);
      
      // Remove user from local state on successful deletion
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      // Show success message
      alert(`✅ User "${userEmail}" has been successfully deleted.`);
      
    } catch (err) {
      console.error('Delete user error:', err);
      
      // Handle specific error cases
      const status = err.response?.status;
      const errorMessage = err.response?.data?.error || err.message;
      
      if (status === 403) {
        if (errorMessage.toLowerCase().includes('self') || errorMessage.toLowerCase().includes('own')) {
          alert('❌ Cannot delete self: You cannot delete your own account');
        } else {
          alert('❌ Permission Denied: You do not have permission to delete this user');
        }
      } else if (status === 404) {
        alert('❌ User not found: This user may have already been deleted');
        // Remove from local state if user doesn't exist on server
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else if (status === 400) {
        alert(`❌ Bad Request: ${errorMessage}`);
      } else if (status === 401) {
        alert('❌ Authentication required: Please log in again');
      } else if (status === 422) {
        alert(`❌ Validation Error: ${errorMessage}`);
      } else if (status === 409) {
        alert(`❌ Conflict: ${errorMessage}`);
      } else if (status >= 500) {
        alert('❌ Server Error: Something went wrong on our end. Please try again later.');
      } else if (errorMessage.toLowerCase().includes('subscription')) {
        alert('❌ Subscription Error: Your subscription may not allow this action');
      } else if (errorMessage.toLowerCase().includes('permission')) {
        alert(`❌ Permission Error: ${errorMessage}`);
      } else {
        alert(`❌ Failed to delete user: ${errorMessage || 'An unexpected error occurred'}`);
      }
    } finally {
      setDeleteLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  useEffect(() => {
    if (canAccessUsers()) {
      fetchUsers();
    }
  }, [user]);

  // Show access denied if user doesn't have permission
  if (!canAccessUsers()) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
        <p>Only tenant administrators can manage users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h2>User Management</h2>
        <button 
          onClick={handleAddUser}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Add New User
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          color: '#6c757d'
        }}>
          <p>No users found in your tenant.</p>
          <button 
            onClick={handleAddUser}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '10px'
            }}
          >
            Add First User
          </button>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  Name
                </th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  Email
                </th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                  Role
                </th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                  Status
                </th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((userData, index) => (
                <tr 
                  key={userData.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa',
                    borderBottom: '1px solid #dee2e6'
                  }}
                >
                  <td style={{ padding: '15px' }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{userData.full_name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '15px', color: '#6c757d' }}>
                    {userData.email}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: userData.role === 'tenant_admin' ? '#dc3545' : '#28a745',
                      color: 'white'
                    }}>
                      {userData.role === 'tenant_admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: userData.is_active ? '#28a745' : '#6c757d',
                      color: 'white'
                    }}>
                      {userData.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleEditUser(userData)}
                        style={{
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(userData.id, userData.email)}
                        disabled={deleteLoading[userData.id] || userData.id === user.id}
                        style={{
                          backgroundColor: userData.id === user.id ? '#6c757d' : '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: userData.id === user.id ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          opacity: deleteLoading[userData.id] ? 0.7 : 1
                        }}
                      >
                        {deleteLoading[userData.id] ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onUserSaved={handleUserSaved}
        user={editingUser}
      />
    </div>
  );
}
