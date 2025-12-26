import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    organizationName: '',
    subdomain: '',
    adminFullName: '',
    adminEmail: '',
    password: '',
    confirmPassword: ''
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
    
    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }
    
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = 'Subdomain is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
      newErrors.subdomain = 'Subdomain can only contain lowercase letters, numbers, and hyphens';
    }
    
    if (!formData.adminFullName.trim()) {
      newErrors.adminFullName = 'Admin full name is required';
    }
    
    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = 'Admin email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.adminEmail)) {
      newErrors.adminEmail = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
        organizationName: formData.organizationName,
        subdomain: formData.subdomain,
        adminFullName: formData.adminFullName,
        adminEmail: formData.adminEmail,
        password: formData.password
      };
      
      await api.post('/auth/register-tenant', payload);
      
      // Success - redirect to login
      alert('Registration successful! Please log in.');
      navigate('/login');
      
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response && error.response.data) {
        const { message } = error.response.data;
        setErrors({ general: message || 'Registration failed' });
      } else {
        setErrors({ general: 'Registration failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Create Your Organization</h2>
      
      <form onSubmit={handleSubmit}>
        {errors.general && (
          <div style={{ color: 'red', marginBottom: '15px', padding: '10px', border: '1px solid red', borderRadius: '4px' }}>
            {errors.general}
          </div>
        )}
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="organizationName" style={{ display: 'block', marginBottom: '5px' }}>
            Organization Name
          </label>
          <input
            type="text"
            id="organizationName"
            name="organizationName"
            value={formData.organizationName}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.organizationName ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter your organization name"
          />
          {errors.organizationName && <span style={{ color: 'red', fontSize: '14px' }}>{errors.organizationName}</span>}
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="subdomain" style={{ display: 'block', marginBottom: '5px' }}>
            Subdomain
          </label>
          <input
            type="text"
            id="subdomain"
            name="subdomain"
            value={formData.subdomain}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.subdomain ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="your-company"
          />
          {errors.subdomain && <span style={{ color: 'red', fontSize: '14px' }}>{errors.subdomain}</span>}
          <small style={{ color: '#666' }}>Your organization will be accessible at: {formData.subdomain}.yourapp.com</small>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="adminFullName" style={{ display: 'block', marginBottom: '5px' }}>
            Admin Full Name
          </label>
          <input
            type="text"
            id="adminFullName"
            name="adminFullName"
            value={formData.adminFullName}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.adminFullName ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter your full name"
          />
          {errors.adminFullName && <span style={{ color: 'red', fontSize: '14px' }}>{errors.adminFullName}</span>}
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="adminEmail" style={{ display: 'block', marginBottom: '5px' }}>
            Admin Email
          </label>
          <input
            type="email"
            id="adminEmail"
            name="adminEmail"
            value={formData.adminEmail}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.adminEmail ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter your email address"
          />
          {errors.adminEmail && <span style={{ color: 'red', fontSize: '14px' }}>{errors.adminEmail}</span>}
        </div>
        
        <div style={{ marginBottom: '15px' }}>
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
            placeholder="Enter password (min 6 characters)"
          />
          {errors.password && <span style={{ color: 'red', fontSize: '14px' }}>{errors.password}</span>}
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '5px' }}>
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: errors.confirmPassword ? '1px solid red' : '1px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Confirm your password"
          />
          {errors.confirmPassword && <span style={{ color: 'red', fontSize: '14px' }}>{errors.confirmPassword}</span>}
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
          {loading ? 'Creating Organization...' : 'Create Organization'}
        </button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <span>Already have an account? </span>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
