# Multi-Tenant SaaS Project Management System

<!-- Final Submission - December 26, 2025 -->

A comprehensive multi-tenant Software-as-a-Service (SaaS) application for project and task management. This system provides secure tenant isolation, role-based access control, and a modern React frontend with Node.js/Express backend.

## 📋 Project Description

This multi-tenant SaaS platform enables organizations to manage projects and tasks in isolated environments. Each tenant has their own data space while sharing the same application infrastructure. The system supports multiple user roles including super administrators, tenant administrators, and regular users.

### Key Features

- **Multi-tenant Architecture**: Complete tenant isolation with secure data separation
- **Role-based Access Control**: Super admin, tenant admin, and user roles with appropriate permissions
- **Project Management**: Create, update, and manage projects within tenant boundaries
- **Task Management**: Comprehensive task tracking with priorities and assignments
- **User Management**: Admin interface for managing tenant users
- **Authentication & Authorization**: JWT-based secure authentication system
- **Health Monitoring**: Built-in health check endpoints for system monitoring

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library with hooks and functional components
- **JavaScript (ES6+)** - Modern JavaScript features
- **CSS3** - Styled components with responsive design
- **Axios** - HTTP client for API communication

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **JWT** - JSON Web Tokens for authentication
- **bcrypt** - Password hashing and security

### Database
- **PostgreSQL** - Relational database with advanced features
- **UUID** - Universally unique identifiers for data integrity

### DevOps & Infrastructure
- **Docker** - Containerization platform
- **Docker Compose** - Multi-container application orchestration

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose installed on your system
- Git for version control

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multi-tenant-saas
   ```

2. **Start the application with Docker**
   ```bash
   docker-compose up -d
   ```

   This command will:
   - Pull and start PostgreSQL database container
   - Build and start the Node.js backend server
   - Build and start the React frontend application
   - Set up networking between all services

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/api/health

### Health Check

To verify the system is running correctly, access the health check endpoint:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected"
}
```

## 👤 Demo Credentials

The system comes pre-seeded with demonstration accounts:

### Super Administrator
- **Email**: superadmin@system.com
- **Password**: Admin@123
- **Access**: Full system administration across all tenants

### Tenant Administrator (Demo Company)
- **Email**: admin@demo.com
- **Password**: Demo@123
- **Access**: Full administration within Demo Company tenant

### Regular Users (Demo Company)
- **Email**: user1@demo.com / user2@demo.com
- **Password**: User@123
- **Access**: Standard user access within Demo Company tenant

## 🎯 System Architecture

### Multi-Tenant Design
- **Tenant Isolation**: Each tenant's data is completely isolated
- **Shared Infrastructure**: Common application code serves all tenants
- **Scalable Design**: Easy to add new tenants and scale resources

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Role-based Authorization**: Granular permission control
- **Password Encryption**: bcrypt hashing for secure password storage
- **Input Validation**: Comprehensive validation and sanitization

### API Endpoints
- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Users**: `/api/users/*` and `/api/tenants/:id/users`
- **Projects**: `/api/projects/*`
- **Tasks**: `/api/tasks/*`
- **Health Check**: `/api/health`

## 📹 Demo Video

Watch the complete system demonstration and walkthrough:

**[Multi-Tenant SaaS Demo Video](https://youtube.com/placeholder)**

The demo video covers:
- System overview and architecture
- User authentication and role management
- Tenant administration features
- Project and task management
- Multi-tenant data isolation demonstration
- Health monitoring and system status

## 🔧 Development

### Project Structure
```
multi-tenant-saas/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Application pages
│   │   ├── context/         # React context providers
│   │   └── services/        # API service layer
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Custom middleware
│   │   ├── models/          # Data models
│   │   ├── routes/          # API route definitions
│   │   └── utils/           # Utility functions
│   ├── migrations/          # Database migrations
│   └── seeds/               # Database seed data
├── database/                # Database configuration
└── docker-compose.yml       # Docker services configuration
```

### Environment Configuration
The application uses environment variables for configuration. Key variables include:
- `DB_HOST`, `DB_PORT`, `DB_NAME` - Database connection
- `JWT_SECRET` - JWT token signing secret
- `PORT` - Application port

## 📝 License

This project is created for educational and demonstration purposes.

---

For questions or support, please refer to the demo video or check the health endpoint status.