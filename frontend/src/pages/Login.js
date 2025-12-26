import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    tenantSubdomain: ''
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
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    if (!formData.tenantSubdomain.trim()) {
      newErrors.tenantSubdomain = 'Tenant subdomain is required';
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
        email: formData.email,
        password: formData.password,
        tenantSubdomain: formData.tenantSubdomain
      };
      
      const response = await api.post('/auth/login', payload);
      
      // Check if response contains token and user data
      if (response.data && response.data.data && response.data.data.token) {
        const { token, user } = response.data.data;
        
        // Use AuthContext login method
        login(token, user);
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setErrors({ general: 'Login failed. Invalid response from server.' });
      }
      
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.response && error.response.data) {
        const { message } = error.response.data;
        setErrors({ general: message || 'Login failed' });
      } else {
        setErrors({ general: 'Login failed. Please check your connection and try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Sign In to Your Organization</h2>
      
      <form onSubmit={handleSubmit}>
        {errors.general && (
          <div style={{ color: 'red', marginBottom: '15px', padding: '10px', border: '1px solid red', borderRadius: '4px' }}>
            {errors.general}
          </div>
        )}
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="tenantSubdomain" style={{ display: 'block', marginBottom: '5px' }}>
            Organization Subdomain
          </label>
          <input
            type="text"
            id="tenantSubdomain"
            name="tenantSubdomain"
            value={formData.tenantSubdomain}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.tenantSubdomain ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="your-company"
          />
          {errors.tenantSubdomain && <span style={{ color: 'red', fontSize: '14px' }}>{errors.tenantSubdomain}</span>}
          <small style={{ color: '#666' }}>Enter your organization's subdomain</small>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.email ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter your email address"
          />
          {errors.email && <span style={{ color: 'red', fontSize: '14px' }}>{errors.email}</span>}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.password ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter your password"
          />
          {errors.password && <span style={{ color: 'red', fontSize: '14px' }}>{errors.password}</span>}
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <span>Don't have an organization? </span>
        <button
          onClick={() => navigate('/register')}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          Create Organization
        </button>
      </div>
    </div>
  );
}
