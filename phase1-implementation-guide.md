# Phase 1 Implementation Guide - Salesforce Org Monitoring MVP

## Overview
This guide provides detailed implementation steps for Phase 1 MVP - a session-based Salesforce org monitoring tool with no user registration required.

## Technical Architecture

### Frontend (React + TypeScript)
- **Landing page** with "Connect to Salesforce" button
- **Dashboard** showing current org limits in real-time
- **Session management** for temporary access (2-4 hours)

### Backend (Node.js + Express)
- **Salesforce OAuth** flow handling
- **Limits API** integration with live polling
- **Session storage** using Redis
- **RESTful API** endpoints

### Infrastructure (AWS)
- **ECS Fargate** for web application
- **Lambda** for Salesforce API calls
- **ElastiCache Redis** for session storage
- **S3** for static assets

## Project Structure

```
force-monitor/
├── frontend/                 # React TypeScript app
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API calls
│   │   ├── types/          # TypeScript definitions
│   │   └── utils/          # Helper functions
│   ├── public/
│   └── package.json
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── types/          # TypeScript definitions
│   │   └── utils/          # Helper functions
│   └── package.json
├── infrastructure/          # AWS CDK/Terraform
│   ├── lib/               # Infrastructure code
│   └── bin/               # Entry points
└── docs/                   # Documentation
```

## Implementation Steps

### Week 1-2: Salesforce OAuth + Session Management

#### Step 1: Setup Development Environment

**1.1 Initialize Projects**
```bash
# Create main project structure
mkdir force-monitor
cd force-monitor

# Frontend setup
npx create-react-app frontend --template typescript
cd frontend
npm install axios react-router-dom recharts
npm install -D @types/node

# Backend setup
cd ../
mkdir backend && cd backend
npm init -y
npm install express cors helmet dotenv redis ioredis
npm install -D @types/express @types/cors @types/node typescript ts-node nodemon
```

**1.2 Configure TypeScript for Backend**
```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Step 2: Salesforce OAuth Implementation

**2.1 Create Salesforce Connected App**
- Log into Salesforce Setup
- Create Connected App with OAuth settings:
  - Callback URL: `http://localhost:3001/auth/salesforce/callback`
  - Scopes: `Access and manage your data (api)`, `Access your basic information (id)`
- Note down Consumer Key and Consumer Secret

**2.2 Backend OAuth Controller**
```typescript
// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import { SalesforceService } from '../services/salesforceService';
import { SessionService } from '../services/sessionService';

export class AuthController {
  
  // Step 1: Redirect to Salesforce OAuth
  static async initiateOAuth(req: Request, res: Response) {
    try {
      const authUrl = SalesforceService.getAuthorizationUrl();
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
  }

  // Step 2: Handle OAuth callback
  static async handleCallback(req: Request, res: Response) {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
      }

      // Exchange code for access token
      const tokenData = await SalesforceService.exchangeCodeForToken(code as string);
      
      // Create session
      const sessionId = await SessionService.createSession({
        accessToken: tokenData.access_token,
        instanceUrl: tokenData.instance_url,
        orgId: tokenData.id.split('/').pop()
      });

      // Redirect to dashboard with session
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?session=${sessionId}`);
    } catch (error) {
      res.status(500).json({ error: 'OAuth callback failed' });
    }
  }
}
```

**2.3 Salesforce Service**
```typescript
// backend/src/services/salesforceService.ts
import axios from 'axios';

interface TokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  signature: string;
  scope: string;
  token_type: string;
}

interface OrgLimits {
  [key: string]: {
    Max: number;
    Remaining: number;
  };
}

export class SalesforceService {
  
  static getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
      scope: 'api id'
    });
    
    return `https://login.salesforce.com/services/oauth2/authorize?${params}`;
  }

  static async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    try {
      const response = await axios.post('https://login.salesforce.com/services/oauth2/token', 
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.SALESFORCE_CLIENT_ID!,
          client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
          redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
          code
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error('Failed to exchange code for token');
    }
  }

  static async getOrgLimits(accessToken: string, instanceUrl: string): Promise<OrgLimits> {
    try {
      const response = await axios.get(
        `${instanceUrl}/services/data/v62.0/limits`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch org limits');
    }
  }
}
```

**2.4 Session Service with Redis**
```typescript
// backend/src/services/sessionService.ts
import Redis from 'ioredis';

interface SessionData {
  accessToken: string;
  instanceUrl: string;
  orgId: string;
}

export class SessionService {
  private static redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  });

  static async createSession(data: SessionData): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiry = 4 * 60 * 60; // 4 hours in seconds
    
    await this.redis.setex(
      `session:${sessionId}`, 
      expiry, 
      JSON.stringify(data)
    );
    
    return sessionId;
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  static async extendSession(sessionId: string): Promise<void> {
    const expiry = 4 * 60 * 60; // 4 hours
    await this.redis.expire(`session:${sessionId}`, expiry);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  private static generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
```

#### Step 3: Express Server Setup

**3.1 Main Server File**
```typescript
// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRoutes } from './routes/authRoutes';
import { limitsRoutes } from './routes/limitsRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/api', limitsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**3.2 Environment Configuration**
```bash
# backend/.env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_consumer_key_here
SALESFORCE_CLIENT_SECRET=your_consumer_secret_here
SALESFORCE_REDIRECT_URI=http://localhost:3001/auth/salesforce/callback

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Week 3: Dashboard + Limits API Integration

#### Step 4: Frontend Implementation

**4.1 Landing Page Component**
```typescript
// frontend/src/pages/LandingPage.tsx
import React from 'react';
import { Button } from '../components/Button';
import { apiService } from '../services/apiService';

export const LandingPage: React.FC = () => {
  const handleConnectToSalesforce = async () => {
    try {
      const response = await apiService.initiateOAuth();
      window.location.href = response.authUrl;
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Monitor Your Salesforce Org Limits
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Get instant insights into your Salesforce org's API limits, storage usage, 
            and other critical metrics. No registration required.
          </p>
          
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Free Access Includes:</h2>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold">Real-time Monitoring</h3>
                  <p className="text-gray-600">Live view of all org limits</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold">No Setup Required</h3>
                  <p className="text-gray-600">Connect with OAuth in seconds</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="font-semibold">Secure Access</h3>
                  <p className="text-gray-600">4-hour temporary sessions</p>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleConnectToSalesforce}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-lg"
          >
            Connect to Salesforce
          </Button>
          
          <p className="text-sm text-gray-500 mt-4">
            Session expires in 4 hours. No data is permanently stored.
          </p>
        </div>
      </div>
    </div>
  );
};
```

**4.2 Dashboard Component**
```typescript
// frontend/src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LimitsCard } from '../components/LimitsCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { apiService } from '../services/apiService';
import { OrgLimits } from '../types/salesforce';

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [limits, setLimits] = useState<OrgLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (!sessionId) {
      setError('No session found. Please connect to Salesforce again.');
      setLoading(false);
      return;
    }

    fetchLimits();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLimits, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const data = await apiService.getOrgLimits(sessionId!);
      setLimits(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch org limits. Session may have expired.');
      console.error('Error fetching limits:', err);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Session Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a 
            href="/" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Connect Again
          </a>
        </div>
      </div>
    );
  }

  if (loading && !limits) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Salesforce Org Limits
            </h1>
            <div className="flex items-center space-x-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchLimits}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {limits && <LimitsGrid limits={limits} />}
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Want Historical Data & Multiple Orgs?
          </h3>
          <p className="text-blue-700 mb-4">
            Upgrade to our paid plan to track changes over time and monitor multiple organizations.
          </p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Coming Soon - Join Waitlist
          </button>
        </div>
      </main>
    </div>
  );
};
```

**4.3 Limits Display Components**
```typescript
// frontend/src/components/LimitsCard.tsx
import React from 'react';

interface LimitData {
  Max: number;
  Remaining: number;
}

interface LimitsCardProps {
  title: string;
  data: LimitData;
  category: 'api' | 'storage' | 'email' | 'other';
}

export const LimitsCard: React.FC<LimitsCardProps> = ({ title, data, category }) => {
  const usagePercent = ((data.Max - data.Remaining) / data.Max) * 100;
  const isHighUsage = usagePercent > 80;
  const isMediumUsage = usagePercent > 60;

  const getCategoryColor = () => {
    switch (category) {
      case 'api': return 'border-blue-200 bg-blue-50';
      case 'storage': return 'border-green-200 bg-green-50';
      case 'email': return 'border-purple-200 bg-purple-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getUsageColor = () => {
    if (isHighUsage) return 'bg-red-500';
    if (isMediumUsage) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`border rounded-lg p-6 ${getCategoryColor()}`}>
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Used: {data.Max - data.Remaining:toLocaleString()}</span>
          <span>Available: {data.Remaining.toLocaleString()}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${getUsageColor()}`}
            style={{ width: `${usagePercent}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>{usagePercent.toFixed(1)}% used</span>
          <span>Max: {data.Max.toLocaleString()}</span>
        </div>
      </div>
      
      {isHighUsage && (
        <div className="mt-3 text-xs text-red-600 font-medium">
          ⚠️ High usage - consider upgrading
        </div>
      )}
    </div>
  );
};
```

#### Step 5: API Service Integration

**5.1 Frontend API Service**
```typescript
// frontend/src/services/apiService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const apiService = {
  async initiateOAuth() {
    const response = await api.get('/auth/salesforce');
    return response.data;
  },

  async getOrgLimits(sessionId: string) {
    const response = await api.get(`/api/limits?session=${sessionId}`);
    return response.data;
  },

  async validateSession(sessionId: string) {
    const response = await api.get(`/api/session/validate?session=${sessionId}`);
    return response.data;
  }
};
```

**5.2 Backend Limits Controller**
```typescript
// backend/src/controllers/limitsController.ts
import { Request, Response } from 'express';
import { SessionService } from '../services/sessionService';
import { SalesforceService } from '../services/salesforceService';

export class LimitsController {
  
  static async getOrgLimits(req: Request, res: Response) {
    try {
      const { session: sessionId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      // Get session data
      const sessionData = await SessionService.getSession(sessionId as string);
      if (!sessionData) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      // Fetch limits from Salesforce
      const limits = await SalesforceService.getOrgLimits(
        sessionData.accessToken, 
        sessionData.instanceUrl
      );

      // Extend session on successful API call
      await SessionService.extendSession(sessionId as string);

      res.json(limits);
    } catch (error) {
      console.error('Error fetching limits:', error);
      res.status(500).json({ error: 'Failed to fetch org limits' });
    }
  }

  static async validateSession(req: Request, res: Response) {
    try {
      const { session: sessionId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({ valid: false });
      }

      const sessionData = await SessionService.getSession(sessionId as string);
      res.json({ valid: !!sessionData });
    } catch (error) {
      res.json({ valid: false });
    }
  }
}
```

### Week 4: Polish + Deployment

#### Step 6: AWS Infrastructure Setup

**6.1 AWS CDK Infrastructure**
```typescript
// infrastructure/lib/force-monitor-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ForceMonitorStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'ForceMonitorVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ElastiCache Redis
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    const redis = new elasticache.CfnCacheCluster(this, 'Redis', {
      cacheNodeType: 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [
        new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
          vpc,
          allowAllOutbound: false,
        }).securityGroupId
      ],
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ForceMonitorCluster', {
      vpc,
    });

    // S3 Bucket for static assets
    const bucket = new s3.Bucket(this, 'StaticAssets', {
      bucketName: `force-monitor-assets-${cdk.Aws.ACCOUNT_ID}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
  }
}
```

#### Step 7: Docker Configuration

**7.1 Backend Dockerfile**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "start"]
```

**7.2 Frontend Dockerfile**
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Step 8: Testing & Validation

**8.1 Backend Unit Tests**
```typescript
// backend/src/tests/sessionService.test.ts
import { SessionService } from '../services/sessionService';

describe('SessionService', () => {
  beforeEach(async () => {
    // Clear Redis test database
    await SessionService['redis'].flushdb();
  });

  test('should create and retrieve session', async () => {
    const sessionData = {
      accessToken: 'test-token',
      instanceUrl: 'https://test.salesforce.com',
      orgId: 'test-org-id'
    };

    const sessionId = await SessionService.createSession(sessionData);
    expect(sessionId).toBeDefined();

    const retrieved = await SessionService.getSession(sessionId);
    expect(retrieved).toEqual(sessionData);
  });

  test('should return null for non-existent session', async () => {
    const result = await SessionService.getSession('non-existent');
    expect(result).toBeNull();
  });
});
```

**8.2 Integration Test Script**
```typescript
// backend/src/tests/integration.test.ts
import request from 'supertest';
import { app } from '../server';

describe('Integration Tests', () => {
  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('GET /auth/salesforce should return auth URL', async () => {
    const response = await request(app).get('/auth/salesforce');
    expect(response.status).toBe(200);
    expect(response.body.authUrl).toContain('login.salesforce.com');
  });
});
```

## Deployment Checklist

### Local Development Setup
- [ ] Frontend runs on http://localhost:3000
- [ ] Backend runs on http://localhost:3001
- [ ] Redis accessible on localhost:6379
- [ ] Environment variables configured
- [ ] Salesforce Connected App created

### Testing Checklist
- [ ] OAuth flow works end-to-end
- [ ] Session creation and validation
- [ ] Limits API integration
- [ ] Error handling for expired sessions
- [ ] Responsive design on mobile

### Security Checklist
- [ ] Environment variables secured
- [ ] CORS properly configured
- [ ] Helmet security headers enabled
- [ ] Session expiration enforced
- [ ] No sensitive data in logs

### Performance Checklist
- [ ] Redis connection pooling
- [ ] API response caching
- [ ] Frontend bundle optimization
- [ ] Images compressed and optimized

## Environment Variables

### Backend (.env)
```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# Salesforce
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=https://api.your-domain.com/auth/salesforce/callback

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
```

### Frontend (.env)
```bash
REACT_APP_API_BASE_URL=https://api.your-domain.com
```

## Monitoring & Logging

### CloudWatch Setup
- Application logs from ECS containers
- Redis connection metrics
- API response times
- Error rate monitoring

### Health Checks
- `/health` endpoint for load balancer
- Redis connectivity check
- Session store availability

## Next Steps for Phase 2

Once Phase 1 is complete and validated:
1. User registration system with Cognito
2. PostgreSQL database for historical data
3. Scheduled Lambda functions for automated polling
4. Multi-org management interface
5. Time-series charts for historical data

This implementation provides a solid foundation for immediate user validation while being architected for easy expansion in Phase 2.