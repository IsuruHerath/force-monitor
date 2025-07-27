# Force Monitor - Salesforce Org Limits Monitoring

A SaaS application for monitoring Salesforce organization limits with real-time insights and analytics.

## Overview

Force Monitor helps managed service providers and Salesforce administrators track their org limits without the complexity of traditional monitoring tools. Get instant insights into API usage, storage limits, and other critical metrics through a simple, session-based interface.

## Features

### Phase 1 (MVP) - Available Now
- **Session-based Access** - No registration required
- **Real-time Monitoring** - Live Salesforce org limits
- **Secure OAuth** - Direct Salesforce authentication
- **4-hour Sessions** - Temporary access with automatic expiry
- **Clean Interface** - Easy-to-understand limit visualizations

### Phase 2 (Coming Soon)
- **User Accounts** - Save your organizations permanently
- **Multi-org Management** - Monitor multiple Salesforce orgs
- **Enhanced Dashboard** - Improved UI for organization management

### Phase 3 (Planned)
- **Historical Data** - Track changes over time
- **Automated Alerts** - Email notifications for high usage
- **Time-series Charts** - Visual trends and analytics
- **Subscription Tiers** - Flexible pricing options

## Architecture

### Backend (Node.js + TypeScript)
- **Express.js** server with TypeScript
- **Redis** for session management
- **Salesforce REST API** integration
- **OAuth 2.0** authentication flow

### Frontend (React + TypeScript)
- **React 18** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Axios** for API communication

### Infrastructure (AWS)
- **ECS Fargate** for application hosting
- **ElastiCache Redis** for session storage
- **CloudFront** for CDN
- **Route 53** for DNS

## Getting Started

### Prerequisites
- Node.js 18+
- Redis server
- Salesforce Connected App

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd force-monitor
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your Salesforce credentials
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm start
   ```

4. **Start Redis**
   ```bash
   redis-server
   ```

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:3001/auth/salesforce/callback

# Redis
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
   - Scopes: `Access and manage your data (api)`, `Access your basic information (id)`
4. Copy Consumer Key and Consumer Secret to backend `.env`

## API Endpoints

### Authentication
- `GET /auth/salesforce` - Initiate OAuth flow
- `GET /auth/salesforce/callback` - Handle OAuth callback

### Data
- `GET /api/limits?session=<sessionId>` - Get org limits
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
│   │   ├── controllers/    # Route handlers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # Express routes
│   │   └── types/          # TypeScript definitions
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API clients
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

- All Salesforce credentials are handled via OAuth 2.0
- Sessions expire automatically after 4 hours
- No permanent storage of user data in Phase 1
- HTTPS enforced in production

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in this repository
- Email: support@forcemonitor.com (coming soon)

## Roadmap

- ✅ Phase 1: Session-based monitoring (Current)
- 🚧 Phase 2: User accounts and multi-org support
- 📋 Phase 3: Historical data and subscriptions
- 📋 Phase 4: Advanced analytics and integrations

---

Built with ❤️ for the Salesforce community