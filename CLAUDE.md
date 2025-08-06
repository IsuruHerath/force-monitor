# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Node.js/TypeScript)
```bash
cd backend
npm install                # Install dependencies
npm run db:generate        # Generate Prisma client
npm run db:push            # Push database schema to PostgreSQL
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
# Terminal 1 - PostgreSQL (required for Phase 2 user accounts)
# Install and start PostgreSQL server

# Terminal 2 - Redis (required for Phase 1 backwards compatibility)
redis-server

# Terminal 3 - Backend API 
cd backend && npm run dev

# Terminal 4 - Frontend
cd frontend && npm start
```

## Architecture Overview

### Phase 2 (Current): User Accounts & Multi-Org Management

#### Authentication Flow (Phase 2)
1. **User Registration/Login**: JWT-based authentication with PostgreSQL storage
2. **Organization Connection**: Users connect multiple Salesforces orgs via OAuth
3. **Token Management**: Encrypted storage of access/refresh tokens per organization
4. **Auto-refresh**: Automatic token refresh when accessing org limits
5. **Multi-org Dashboard**: Users can switch between connected organizations

#### Legacy Session Flow (Phase 1 - Backwards Compatible)
1. **OAuth Initiation**: Frontend calls `/auth/salesforce` to get Salesforce OAuth URL
2. **User Authorization**: User authenticates with Salesforce  
3. **Token Exchange**: Backend receives OAuth callback, exchanges code for access token
4. **Session Creation**: SessionService stores token in Redis with 4-hour expiry
5. **Frontend Redirect**: User redirected to dashboard with session ID in URL

### Backend Architecture (Express/TypeScript + PostgreSQL)
- **Database**: PostgreSQL with Prisma ORM for data persistence
- **Controllers**: Handle HTTP requests
  - `authController.ts`: OAuth flows (Phase 1 & 2)
  - `userController.ts`: User registration, login, profile management
  - `organizationController.ts`: Multi-org CRUD operations  
  - `limitsController.ts`: Org limits (supports both phases)
- **Services**: Business logic layer
  - `AuthService`: JWT authentication, user management
  - `OrganizationService`: Multi-org management with encrypted token storage
  - `SalesforceService`: OAuth flow and Salesforce API integration (enhanced with refresh)
  - `SessionService`: Redis-based session management (Phase 1 compatibility)
  - `DatabaseService`: Prisma connection management
- **Middleware**: `authMiddleware.ts` for JWT token validation
- **Routes**: API endpoints for users, organizations, auth, and limits
- **Server**: Express app with database connection and graceful shutdown

### Frontend Architecture (React/TypeScript)
- **Router**: Multi-page app with protected routes
  - Landing Page (supports both access methods)
  - Login/Register Pages  
  - Dashboard (dual-mode: session-based or authenticated)
  - Organizations Management Page
  - OAuth Callback Handler
- **Context Management**: 
  - `AuthContext`: User authentication state and JWT management
  - `OrganizationContext`: Multi-org state and operations
- **API Service**: Centralized HTTP client with JWT token injection
- **Components**: Enhanced UI components
  - `ProtectedRoute`: Authentication guard for secure pages
  - `OrganizationSelector`: Dropdown for switching between orgs
  - Existing components (LimitsCard, LimitsGrid, LoadingSpinner, etc.)
- **Auto-refresh**: Dashboard fetches limits every 5 minutes (organization-aware)

### Key Data Flows

#### Phase 2 (Authenticated Users)
1. User authenticates and JWT token stored in localStorage
2. User selects organization from connected orgs
3. Dashboard calls `/api/organizations/{orgId}/limits` with JWT auth
4. OrganizationService decrypts tokens and calls Salesforce API  
5. Auto-refresh tokens if expired, retry API call
6. LimitsGrid renders organization-specific data

#### Phase 1 (Session-based - Legacy)
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

# Database (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/force_monitor?schema=public"

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Encryption (for storing Salesforce tokens)
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Salesforce OAuth  
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret  
SALESFORCE_REDIRECT_URI=http://localhost:3001/auth/salesforce/callback

# Redis (for Phase 1 backwards compatibility)
REDIS_HOST=localhost
REDIS_PORT=6379
```

Frontend `.env`:
```env
REACT_APP_API_BASE_URL=http://localhost:3001
```

### PostgreSQL Setup (Required for Phase 2)
1. Install PostgreSQL server
2. Create database: `createdb force_monitor`
3. Update DATABASE_URL in backend `.env` with your credentials
4. Run database setup: `cd backend && npm run db:push`

### Salesforce Connected App Requirements
- OAuth enabled with callback URL: `http://localhost:3001/auth/salesforce/callback`
- Required scopes: `api` (access data), `id` (basic info), and `refresh_token` (token refresh)
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