# Force Monitor - Salesforce Org Limits Monitoring

A SaaS application for monitoring Salesforce organization limits with real-time insights and analytics.

## Overview

Force Monitor helps managed service providers and Salesforce administrators track their org limits without the complexity of traditional monitoring tools. Get instant insights into API usage, storage limits, and other critical metrics through user accounts with multi-org management, or use the simple session-based interface for quick access.

## Features

### Phase 3 (Current) - Available Now
- **Historical Data Tracking** - Automatic background data collection every hour
- **Time-series Analytics** - Interactive charts with trend analysis (increasing/decreasing/stable)
- **Configurable Dashboards** - 40+ Salesforce metrics with custom chart builder
- **Dashboard Templates** - Predefined templates (Admin Essentials, Email Monitoring, Developer Dashboard, etc.)
- **Multi-granularity Views** - Hourly, daily, and weekly data aggregation
- **Flexible Time Ranges** - 7, 30, or 90-day historical views
- **Trend Intelligence** - Smart fallback from daily to hourly data for better insights
- **Template Management** - Save and manage custom dashboard configurations

### Phase 2 (Completed) - Multi-Org Management
- **User Accounts** - Register and login with JWT authentication
- **Multi-org Management** - Connect and monitor multiple Salesforce orgs
- **Encrypted Token Storage** - Secure storage of Salesforce tokens with automatic refresh
- **Organization Dashboard** - Switch between connected orgs seamlessly
- **Enhanced Navigation** - Single Page Application with persistent navigation
- **Dual Access Modes** - Supports both authenticated users and legacy session-based access

### Phase 1 (Legacy) - Backwards Compatible
- **Session-based Access** - No registration required (still supported)
- **Real-time Monitoring** - Live Salesforce org limits
- **Secure OAuth** - Direct Salesforce authentication
- **4-hour Sessions** - Temporary access with automatic expiry
- **Clean Interface** - Easy-to-understand limit visualizations

### Phase 3 Pending Features
- **Automated Alerts** - Email notifications for threshold monitoring (database schema ready)
- **Subscription Tiers** - Free/Pro/Enterprise pricing with feature restrictions
- **Email Notifications** - SES integration for alert delivery

## Architecture

### Backend (Node.js + TypeScript)
- **Express.js** server with TypeScript
- **PostgreSQL** database with Prisma ORM (Phase 3 historical data schema)
- **JWT Authentication** for user accounts
- **Redis** for session management (Phase 1 compatibility)
- **Salesforce REST API** integration with token refresh
- **OAuth 2.0** authentication flow (dual-mode support)
- **AES-256-GCM** encryption for sensitive token storage
- **Background Data Collection** - Automated hourly Salesforce polling
- **Scheduled Jobs** - Cron-based data collection and analytics
- **Trend Analysis Engine** - Intelligent data aggregation with growth rate calculations

### Frontend (React + TypeScript)
- **React 19** with TypeScript
- **React Router** for Single Page Application navigation
- **Context API** for state management (Auth & Organizations)
- **Tailwind CSS** for styling
- **Axios** for API communication with JWT token injection
- **Recharts** for interactive time-series visualizations
- **Local Storage** for dashboard template persistence
- **Custom Chart Builder** - Dynamic metric selection with 40+ options
- **Responsive Design** - Optimized for desktop and mobile

### Infrastructure (AWS)
- **ECS Fargate** for application hosting
- **ElastiCache Redis** for session storage
- **CloudFront** for CDN
- **Route 53** for DNS

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis server (for Phase 1 compatibility)
- Salesforce Connected App

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd force-monitor
   ```

2. **Database Setup**
   ```bash
   # Install and start PostgreSQL
   # Create database
   createdb force_monitor
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database and Salesforce credentials
   npm run db:generate  # Generate Prisma client
   npm run db:push      # Setup database schema
   npm run dev
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm start
   ```

5. **Start Redis** (for Phase 1 compatibility)
   ```bash
   redis-server
   ```

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/force_monitor?schema=public"

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Encryption (for storing Salesforce tokens - must be 32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:3001/auth/salesforce/callback

# Redis (for Phase 1 compatibility)
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Frontend (.env)
```env
REACT_APP_API_BASE_URL=http://localhost:3001
```

### Salesforce Connected App Setup

1. Go to Salesforce Setup → App Manager
2. Create New Connected App
3. Enable OAuth Settings:
   - Callback URL: `http://localhost:3001/auth/salesforce/callback`
   - Scopes: `Access and manage your data (api)`, `Access your basic information (id)`, `Perform requests on your behalf at any time (refresh_token)`
4. Copy Consumer Key and Consumer Secret to backend `.env`

## API Endpoints

### Authentication (Phase 2)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/validate` - Validate JWT token
- `GET /api/auth/connect-org` - Initiate organization connection
- `GET /auth/salesforce/callback` - Handle OAuth callback

### Organizations (Phase 2)
- `GET /api/organizations` - Get user's connected organizations
- `POST /api/organizations/connect` - Connect new organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Remove organization
- `GET /api/organizations/:id/limits` - Get organization limits
- `POST /api/organizations/:id/refresh-token` - Refresh organization token

### Historical Data & Analytics (Phase 3)
- `GET /api/organizations/:id/history` - Get historical data with time range and granularity
- `GET /api/organizations/:id/trends` - Get trend analysis for organization
- `POST /api/history/collect` - Trigger manual data collection
- `GET /api/history/trigger-collection` - Admin endpoint for data collection

### Legacy Authentication (Phase 1)
- `GET /auth/salesforce` - Initiate OAuth flow (session-based)
- `GET /auth/salesforce/callback` - Handle OAuth callback (session-based)

### Legacy Data (Phase 1)
- `GET /api/limits?session=<sessionId>` - Get org limits (session-based)
- `GET /api/session/validate?session=<sessionId>` - Validate session

## Development

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Building for Production
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Deployment

The application is designed to run on AWS with the following services:
- ECS Fargate for container hosting
- ElastiCache for Redis
- CloudFront for CDN
- Route 53 for DNS

See `/infrastructure` directory for AWS CDK deployment scripts.

## Project Structure

```
force-monitor/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/    # Route handlers (auth, user, organization, limits, history)
│   │   ├── services/       # Business logic (auth, database, organization, salesforce, session, history, scheduler)
│   │   ├── routes/         # Express routes
│   │   ├── middleware/     # Authentication middleware
│   │   ├── utils/          # Utilities (JWT, encryption)
│   │   └── types/          # TypeScript definitions
│   ├── prisma/             # Database schema with Phase 3 historical data models
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components (Navigation, Charts, MetricSelector, etc.)
│   │   │   ├── HistoryChart.tsx        # Time-series chart component
│   │   │   ├── HistoryDashboard.tsx    # Main analytics dashboard
│   │   │   ├── CustomChart.tsx         # Dynamic metric charts
│   │   │   ├── MetricSelector.tsx      # 40+ metric selector
│   │   │   ├── DashboardTemplates.tsx  # Template management
│   │   │   └── TrendAnalysis.tsx       # Trend display component
│   │   ├── contexts/       # React contexts (Auth, Organization)
│   │   ├── pages/          # Page components (Dashboard, Login, Organizations, Analytics)
│   │   ├── services/       # API clients with Phase 3 endpoints
│   │   └── types/          # TypeScript definitions
│   └── package.json
├── infrastructure/         # AWS infrastructure
└── docs/                  # Documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

### Phase 2 Security Features
- **JWT Authentication** with secure token storage
- **AES-256-GCM Encryption** for Salesforce tokens in database
- **Automatic Token Refresh** to maintain security
- **Protected Routes** requiring authentication
- **Input Validation** and sanitization

### Phase 1 Security (Legacy)
- **OAuth 2.0** for Salesforce authentication
- **Sessions expire** automatically after 4 hours
- **Redis-based storage** for temporary sessions
- **No permanent storage** of user data

### General Security
- **HTTPS enforced** in production
- **CORS protection** with specific origins
- **Helmet middleware** for security headers
- **Environment variables** for sensitive configuration

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in this repository
- Email: support@forcemonitor.com (coming soon)

## Roadmap

- ✅ Phase 1: Session-based monitoring (Legacy support)
- ✅ Phase 2: User accounts and multi-org support
- 🚧 Phase 3: Historical data and analytics (~75% complete)
- 📋 Phase 4: Advanced analytics and integrations

### Phase 3 Completed Features (Current)
- ✅ Historical data collection (automated hourly background jobs)
- ✅ Time-series analytics dashboard with interactive charts
- ✅ Configurable dashboards with 40+ Salesforce metrics
- ✅ Dashboard template system (predefined + custom)
- ✅ Trend analysis with intelligent data aggregation
- ✅ Multi-granularity views (hourly/daily/weekly)
- ✅ Single Page Application navigation
- ✅ Token refresh automation for continuous data collection

### Phase 3 Pending Features
- 📋 Automated alerts system with email notifications
- 📋 Subscription tiers (Free/Pro/Enterprise)
- 📋 Payment processing with Stripe integration

### Phase 2 Completed Features
- ✅ User registration and authentication
- ✅ JWT-based session management  
- ✅ Multi-organization connection and management
- ✅ Encrypted token storage with auto-refresh
- ✅ Enhanced dashboard with org switching
- ✅ Navigation and user interface improvements
- ✅ Backwards compatibility with Phase 1

---

Built with ❤️ for the Salesforce community