# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Node.js/TypeScript)
```bash
cd backend
npm install                # Install dependencies
npm run dev                # Development server with hot reload
npm run build              # Build TypeScript to JavaScript  
npm start                  # Production server (requires build first)
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm install                # Install dependencies
npm start                  # Development server (port 3000)
npm run build              # Production build
npm test                   # Run test suite
```

### Full Development Setup
Start all services for local development:
```bash
# Terminal 1 - Redis (required for sessions)
redis-server

# Terminal 2 - Backend API 
cd backend && npm run dev

# Terminal 3 - Frontend
cd frontend && npm start
```

## Architecture Overview

### Authentication & Session Flow
1. **OAuth Initiation**: Frontend calls `/auth/salesforce` to get Salesforce OAuth URL
2. **User Authorization**: User authenticates with Salesforce  
3. **Token Exchange**: Backend receives OAuth callback, exchanges code for access token
4. **Session Creation**: SessionService stores token in Redis with 4-hour expiry
5. **Frontend Redirect**: User redirected to dashboard with session ID in URL

### Backend Architecture (Express/TypeScript)
- **Controllers**: Handle HTTP requests (`authController.ts`, `limitsController.ts`)
- **Services**: Business logic layer
  - `SalesforceService`: OAuth flow and Salesforce API integration
  - `SessionService`: Redis-based session management with 4-hour expiry
- **Routes**: Define API endpoints (`authRoutes.ts`, `limitsRoutes.ts`)
- **Server**: Express app with CORS, Helmet security, JSON middleware

### Frontend Architecture (React/TypeScript)
- **Router**: Simple two-page app (Landing → Dashboard)
- **API Service**: Centralized HTTP client using Axios with credentials
- **State Management**: Local React state (no global state library)
- **Components**: Reusable UI components (`LimitsCard`, `LimitsGrid`, `LoadingSpinner`)
- **Auto-refresh**: Dashboard fetches limits every 5 minutes

### Key Data Flow
1. Dashboard extracts session ID from URL params
2. Calls `/api/limits?session={sessionId}` to fetch org limits
3. SessionService validates session and retrieves stored Salesforce tokens
4. SalesforceService makes authenticated API call to get org limits
5. LimitsGrid component renders limit cards with usage percentages

## Environment Setup

### Required Environment Variables

Backend `.env`:
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret  
SALESFORCE_REDIRECT_URI=http://localhost:3001/auth/salesforce/callback
REDIS_HOST=localhost
REDIS_PORT=6379
```

Frontend `.env`:
```env
REACT_APP_API_BASE_URL=http://localhost:3001
```

### Salesforce Connected App Requirements
- OAuth enabled with callback URL: `http://localhost:3001/auth/salesforce/callback`
- Required scopes: `api` (access data) and `id` (basic info)
- Use Consumer Key/Secret as CLIENT_ID/CLIENT_SECRET

## Key Implementation Details

### Session Management
- Redis-based with 4-hour automatic expiry
- Session ID format: random string + timestamp  
- Sessions store: `accessToken`, `instanceUrl`, `orgId`
- No persistent user accounts in Phase 1

### Error Handling
- Frontend displays user-friendly errors for expired sessions
- Backend logs detailed errors while returning generic messages
- Automatic redirect to landing page on session failures

### Security Considerations
- CORS configured for specific frontend origin
- Helmet middleware for security headers
- Credentials included in API requests
- No sensitive data stored in frontend
- OAuth tokens only in backend Redis

### API Integration
- Salesforce REST API v62.0
- `/services/data/v62.0/limits` endpoint for org limits
- Bearer token authentication
- Instance URL extracted from OAuth response