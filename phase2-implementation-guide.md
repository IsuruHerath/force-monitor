# Phase 2 Implementation Guide - User Accounts & Multi-Org Support

## Overview
Phase 2 builds upon the MVP by adding user registration, user account management, and multi-org support. Historical data tracking is reserved for Phase 3 when subscriptions are enabled.

## Prerequisites
- Phase 1 MVP completed and deployed
- Users validated the product value through session-based access
- Ready to add persistent storage and user accounts

## Technical Architecture Changes

### New Components Added
- **AWS Cognito** - User authentication and management
- **RDS PostgreSQL** - User and organization data storage (no historical metrics yet)
- **Multi-org dashboard** - Manage multiple Salesforce orgs
- **Live polling enhancement** - On-demand polling for multiple orgs

### Database Schema Design
```sql
-- Users table (managed by Cognito, but we store additional data)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_user_id VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id VARCHAR(18) NOT NULL, -- Salesforce org ID
  name VARCHAR(255) NOT NULL,
  instance_url VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  last_polled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, org_id)
);

-- NOTE: Metrics table will be added in Phase 3 when subscriptions are enabled
-- Phase 2 focuses on live data only

-- NOTE: Alerts table will be added in Phase 3 with subscription features
```

## Implementation Steps

### Week 5-6: User Accounts & Database Setup

#### Step 1: AWS Infrastructure Updates

**1.1 Add RDS PostgreSQL to CDK Stack**
```typescript
// infrastructure/lib/force-monitor-stack.ts - Add to existing stack
import * as rds from 'aws-cdk-lib/aws-rds';

// Add after existing resources
const database = new rds.DatabaseInstance(this, 'PostgreSQLDatabase', {
  engine: rds.DatabaseInstanceEngine.postgres({
    version: rds.PostgresEngineVersion.VER_15_4,
  }),
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  credentials: rds.Credentials.fromGeneratedSecret('postgres', {
    secretName: 'force-monitor/db-credentials',
  }),
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
  },
  databaseName: 'forcemonitor',
  deletionProtection: false, // Set to true in production
  backupRetention: cdk.Duration.days(7),
  deleteAutomatedBackups: false,
});

// Add Cognito User Pool
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'force-monitor-users',
  signInAliases: {
    email: true,
  },
  selfSignUpEnabled: true,
  userVerification: {
    emailSubject: 'Verify your Force Monitor account',
    emailBody: 'Your verification code is {####}',
    emailStyle: cognito.VerificationEmailStyle.CODE,
  },
  standardAttributes: {
    email: {
      required: true,
    },
    givenName: {
      required: true,
    },
    familyName: {
      required: true,
    },
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: false,
  },
});

const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
  userPool,
  authFlows: {
    adminUserPassword: true,
    userSrp: true,
  },
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
    callbackUrls: ['http://localhost:3000/auth/callback'], // Update for production
  },
});
```

#### Step 2: Database Service Layer

**2.1 Database Connection Setup**
```typescript
// backend/src/services/databaseService.ts
import { Pool } from 'pg';
import { SecretsManager } from 'aws-sdk';

interface DbCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

export class DatabaseService {
  private static pool: Pool;
  private static secretsManager = new SecretsManager();

  static async initialize() {
    if (!this.pool) {
      const credentials = await this.getDbCredentials();
      
      this.pool = new Pool({
        user: credentials.username,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
        database: credentials.dbname,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return this.pool;
  }

  private static async getDbCredentials(): Promise<DbCredentials> {
    if (process.env.NODE_ENV === 'development') {
      return {
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT!),
        dbname: process.env.DB_NAME!,
      };
    }

    // Production: Get from AWS Secrets Manager
    const secret = await this.secretsManager
      .getSecretValue({ SecretId: 'force-monitor/db-credentials' })
      .promise();
    
    return JSON.parse(secret.SecretString!);
  }

  static async query(text: string, params?: any[]) {
    const pool = await this.initialize();
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  static async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const pool = await this.initialize();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

**2.2 User Service**
```typescript
// backend/src/services/userService.ts
import { DatabaseService } from './databaseService';

interface User {
  id: string;
  cognitoUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

interface CreateUserData {
  cognitoUserId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export class UserService {
  
  static async createUser(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (cognito_user_id, email, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, cognito_user_id, email, first_name, last_name, created_at
    `;
    
    const result = await DatabaseService.query(query, [
      userData.cognitoUserId,
      userData.email,
      userData.firstName,
      userData.lastName,
    ]);
    
    return this.mapDbRowToUser(result.rows[0]);
  }

  static async getUserByCognitoId(cognitoUserId: string): Promise<User | null> {
    const query = `
      SELECT id, cognito_user_id, email, first_name, last_name, created_at
      FROM users 
      WHERE cognito_user_id = $1
    `;
    
    const result = await DatabaseService.query(query, [cognitoUserId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToUser(result.rows[0]);
  }

  static async getUserById(userId: string): Promise<User | null> {
    const query = `
      SELECT id, cognito_user_id, email, first_name, last_name, created_at
      FROM users 
      WHERE id = $1
    `;
    
    const result = await DatabaseService.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToUser(result.rows[0]);
  }

  private static mapDbRowToUser(row: any): User {
    return {
      id: row.id,
      cognitoUserId: row.cognito_user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      createdAt: row.created_at,
    };
  }
}
```

#### Step 3: Cognito Integration

**3.1 Authentication Middleware**
```typescript
// backend/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { UserService } from '../services/userService';

// Create the verifier outside the middleware for better performance
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    cognitoUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify the JWT token
    const payload = await verifier.verify(token);
    
    // Get user from database
    const user = await UserService.getUserByCognitoId(payload.sub);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
```

**3.2 User Registration Controller**
```typescript
// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { UserService } from '../services/userService';

const cognito = new CognitoIdentityServiceProvider();

export class UserController {
  
  static async registerUser(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Create user in Cognito
      const params = {
        ClientId: process.env.COGNITO_CLIENT_ID!,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
        ],
      };

      const cognitoResult = await cognito.signUp(params).promise();
      
      // Create user in our database
      const user = await UserService.createUser({
        cognitoUserId: cognitoResult.UserSub!,
        email,
        firstName,
        lastName,
      });

      res.status(201).json({
        message: 'User registered successfully. Please check your email for verification.',
        userId: user.id,
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.code === 'UsernameExistsException') {
        return res.status(400).json({ error: 'User already exists' });
      }
      
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  static async confirmUser(req: Request, res: Response) {
    try {
      const { email, confirmationCode } = req.body;

      const params = {
        ClientId: process.env.COGNITO_CLIENT_ID!,
        Username: email,
        ConfirmationCode: confirmationCode,
      };

      await cognito.confirmSignUp(params).promise();
      
      res.json({ message: 'User confirmed successfully' });
    } catch (error) {
      console.error('Confirmation error:', error);
      res.status(400).json({ error: 'Invalid confirmation code' });
    }
  }

  static async signIn(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      };

      const result = await cognito.initiateAuth(params).promise();
      
      res.json({
        accessToken: result.AuthenticationResult?.AccessToken,
        refreshToken: result.AuthenticationResult?.RefreshToken,
        idToken: result.AuthenticationResult?.IdToken,
        expiresIn: result.AuthenticationResult?.ExpiresIn,
      });
    } catch (error) {
      console.error('Sign in error:', error);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  }
}
```

### Week 7-8: Multi-Org Dashboard & Live Polling

#### Step 4: Organization Management (Live Data Only)

**4.1 Organization Service**
```typescript
// backend/src/services/organizationService.ts
import { DatabaseService } from './databaseService';
import { EncryptionService } from './encryptionService';

interface Organization {
  id: string;
  userId: string;
  orgId: string;
  name: string;
  instanceUrl: string;
  isActive: boolean;
  lastPolledAt: Date | null;
  createdAt: Date;
}

interface CreateOrgData {
  userId: string;
  orgId: string;
  name: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
}

export class OrganizationService {
  
  static async createOrganization(orgData: CreateOrgData): Promise<Organization> {
    const encryptedAccessToken = await EncryptionService.encrypt(orgData.accessToken);
    const encryptedRefreshToken = orgData.refreshToken 
      ? await EncryptionService.encrypt(orgData.refreshToken)
      : null;

    const query = `
      INSERT INTO organizations (user_id, org_id, name, instance_url, access_token_encrypted, refresh_token_encrypted)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, org_id, name, instance_url, is_active, last_polled_at, created_at
    `;
    
    const result = await DatabaseService.query(query, [
      orgData.userId,
      orgData.orgId,
      orgData.name,
      orgData.instanceUrl,
      encryptedAccessToken,
      encryptedRefreshToken,
    ]);
    
    return this.mapDbRowToOrganization(result.rows[0]);
  }

  static async getUserOrganizations(userId: string): Promise<Organization[]> {
    const query = `
      SELECT id, user_id, org_id, name, instance_url, is_active, last_polled_at, created_at
      FROM organizations 
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;
    
    const result = await DatabaseService.query(query, [userId]);
    return result.rows.map(this.mapDbRowToOrganization);
  }

  static async getOrganizationWithCredentials(orgId: string, userId: string) {
    const query = `
      SELECT id, user_id, org_id, name, instance_url, access_token_encrypted, refresh_token_encrypted, is_active, last_polled_at, created_at
      FROM organizations 
      WHERE id = $1 AND user_id = $2 AND is_active = true
    `;
    
    const result = await DatabaseService.query(query, [orgId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const accessToken = await EncryptionService.decrypt(row.access_token_encrypted);
    const refreshToken = row.refresh_token_encrypted 
      ? await EncryptionService.decrypt(row.refresh_token_encrypted)
      : null;

    return {
      ...this.mapDbRowToOrganization(row),
      accessToken,
      refreshToken,
    };
  }

  // NOTE: updateLastPolledAt will be used in Phase 3 for scheduled polling
  // Phase 2 focuses on on-demand polling only

  static async deactivateOrganization(orgId: string, userId: string) {
    const query = `
      UPDATE organizations 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `;
    
    await DatabaseService.query(query, [orgId, userId]);
  }

  private static mapDbRowToOrganization(row: any): Organization {
    return {
      id: row.id,
      userId: row.user_id,
      orgId: row.org_id,
      name: row.name,
      instanceUrl: row.instance_url,
      isActive: row.is_active,
      lastPolledAt: row.last_polled_at,
      createdAt: row.created_at,
    };
  }
}
```

#### Step 5: Live Polling Controller

**5.1 Live Polling for Multiple Orgs**
```typescript
// backend/src/controllers/liveLimitsController.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { OrganizationService } from '../services/organizationService';
import { SalesforceService } from '../services/salesforceService';
interface OrgLimitsResult {
  organizationId: string;
  organizationName: string;
  limits: any;
  error?: string;
}

export class LiveLimitsController {
  
  static async getAllOrganizationLimits(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      
      // Get user's organizations
      const organizations = await OrganizationService.getUserOrganizations(userId);
      
      if (organizations.length === 0) {
        return res.json({ organizations: [] });
      }
      
      // Fetch limits for all organizations in parallel
      const results = await Promise.allSettled(
        organizations.map(org => this.fetchOrgLimits(org))
      );
      
      const orgLimits: OrgLimitsResult[] = results.map((result, index) => {
        const org = organizations[index];
        
        if (result.status === 'fulfilled') {
          return {
            organizationId: org.id,
            organizationName: org.name,
            limits: result.value,
          };
        } else {
          return {
            organizationId: org.id,
            organizationName: org.name,
            limits: null,
            error: 'Failed to fetch limits - token may be expired',
          };
        }
      });
      
      res.json({ organizations: orgLimits });
    } catch (error) {
      console.error('Error fetching all organization limits:', error);
      res.status(500).json({ error: 'Failed to fetch organization limits' });
    }
  }

  static async getSingleOrganizationLimits(req: AuthenticatedRequest, res: Response) {
    try {
      const { organizationId } = req.params;
      const userId = req.user!.id;
      
      // Get organization with credentials
      const org = await OrganizationService.getOrganizationWithCredentials(organizationId, userId);
      
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      // Fetch current limits
      const limits = await SalesforceService.getOrgLimits(org.accessToken, org.instanceUrl);
      
      res.json({
        organizationId: org.id,
        organizationName: org.name,
        limits,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching organization limits:', error);
      
      if (error.response?.status === 401) {
        return res.status(401).json({ 
          error: 'Access token expired. Please re-authenticate this organization.' 
        });
      }
      
      res.status(500).json({ error: 'Failed to fetch organization limits' });
    }
  }

  private static async fetchOrgLimits(org: any) {
    const orgWithCredentials = await OrganizationService.getOrganizationWithCredentials(org.id, org.userId);
    
    if (!orgWithCredentials) {
      throw new Error('Organization credentials not found');
    }
    
    return await SalesforceService.getOrgLimits(
      orgWithCredentials.accessToken,
      orgWithCredentials.instanceUrl
    );
  }
}
```

#### Step 6: Multi-Org Dashboard Frontend

**6.1 Updated Dashboard for Multiple Organizations**
```typescript
// frontend/src/pages/MultiOrgDashboard.tsx
import React, { useState, useEffect } from 'react';
import { OrganizationCard } from '../components/OrganizationCard';
import { LimitsGrid } from '../components/LimitsGrid';
import { AddOrganizationModal } from '../components/AddOrganizationModal';
import { useAuth } from '../contexts/AuthContext';
import { organizationService } from '../services/organizationService';

export const MultiOrgDashboard: React.FC = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgLimits, setOrgLimits] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await organizationService.getUserOrganizations();
      setOrganizations(orgs);
      
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0]);
        // Fetch limits for all organizations
        await fetchAllOrgLimits(orgs);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOrgLimits = async (orgs = organizations) => {
    try {
      setRefreshing(true);
      const limitsPromises = orgs.map(async (org) => {
        try {
          const limits = await organizationService.getOrganizationLimits(org.id);
          return { orgId: org.id, limits: limits.limits, error: null };
        } catch (error) {
          return { orgId: org.id, limits: null, error: error.message };
        }
      });

      const results = await Promise.all(limitsPromises);
      const limitsMap = {};
      
      results.forEach(result => {
        limitsMap[result.orgId] = {
          limits: result.limits,
          error: result.error,
          lastUpdated: new Date(),
        };
      });

      setOrgLimits(limitsMap);
    } catch (error) {
      console.error('Failed to fetch organization limits:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Organizations Dashboard
            </h1>
            <div className="flex space-x-4">
              <button
                onClick={() => fetchAllOrgLimits()}
                disabled={refreshing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing...' : 'Refresh All'}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Add Organization
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-600 mb-4">
              No Organizations Found
            </h3>
            <p className="text-gray-500 mb-6">
              Add your first Salesforce organization to start monitoring.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Organizations Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Organizations</h2>
                <div className="space-y-2">
                  {organizations.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => setSelectedOrg(org)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedOrg?.id === org.id
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <h3 className="font-medium">{org.name}</h3>
                      <p className="text-sm text-gray-500">{org.orgId}</p>
                      {orgLimits[org.id]?.error && (
                        <p className="text-xs text-red-500 mt-1">
                          Error: {orgLimits[org.id].error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {selectedOrg && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedOrg.name}</h2>
                      <p className="text-gray-600">Current Limits (Live Data)</p>
                    </div>
                    {orgLimits[selectedOrg.id]?.lastUpdated && (
                      <p className="text-sm text-gray-500">
                        Last updated: {orgLimits[selectedOrg.id].lastUpdated.toLocaleTimeString()}
                      </p>
                    )}
                  </div>

                  {orgLimits[selectedOrg.id]?.limits ? (
                    <LimitsGrid limits={orgLimits[selectedOrg.id].limits} />
                  ) : orgLimits[selectedOrg.id]?.error ? (
                    <div className="text-center py-8">
                      <p className="text-red-600 mb-4">
                        Failed to load limits: {orgLimits[selectedOrg.id].error}
                      </p>
                      <button
                        onClick={() => fetchAllOrgLimits([selectedOrg])}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Loading limits...</p>
                    </div>
                  )}

                  <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                      Want Historical Data & Trends?
                    </h3>
                    <p className="text-yellow-700 mb-4">
                      Upgrade to our paid plan to track changes over time, set up alerts, 
                      and get historical analytics for better capacity planning.
                    </p>
                    <button className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700">
                      Coming Soon - Join Waitlist
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### Week 9: Frontend Integration

#### Step 7: Frontend User Authentication

**7.1 Auth Context**
```typescript
// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../services/authService';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const userData = await AuthService.getCurrentUser(token);
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('accessToken');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const authResult = await AuthService.signIn(email, password);
      localStorage.setItem('accessToken', authResult.accessToken);
      localStorage.setItem('refreshToken', authResult.refreshToken);
      
      const userData = await AuthService.getCurrentUser(authResult.accessToken);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const signOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

**7.2 Multi-Org Dashboard**
```typescript
// frontend/src/pages/OrganizationDashboard.tsx
import React, { useState, useEffect } from 'react';
import { OrganizationCard } from '../components/OrganizationCard';
import { MetricChart } from '../components/MetricChart';
import { AddOrganizationModal } from '../components/AddOrganizationModal';
import { useAuth } from '../contexts/AuthContext';
import { organizationService } from '../services/organizationService';

export const OrganizationDashboard: React.FC = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await organizationService.getUserOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrg) {
        setSelectedOrg(orgs[0]);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrganization = async (orgData) => {
    try {
      await organizationService.addOrganization(orgData);
      await fetchOrganizations();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add organization:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Organizations Dashboard
            </h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Organization
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Organizations Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Organizations</h2>
              <div className="space-y-2">
                {organizations.map((org) => (
                  <OrganizationCard
                    key={org.id}
                    organization={org}
                    isSelected={selectedOrg?.id === org.id}
                    onClick={() => setSelectedOrg(org)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedOrg ? (
              <OrganizationDetails organization={selectedOrg} />
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <h3 className="text-lg font-semibold text-gray-600 mb-4">
                  No Organizations Found
                </h3>
                <p className="text-gray-500 mb-6">
                  Add your first Salesforce organization to start monitoring.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                >
                  Add Organization
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddOrganizationModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddOrganization}
        />
      )}
    </div>
  );
};
```

## Migration Strategy from Phase 1

### Data Migration
```typescript
// scripts/migrate-phase1-to-phase2.ts
import { SessionService } from '../src/services/sessionService';
import { UserService } from '../src/services/userService';
import { OrganizationService } from '../src/services/organizationService';

export async function migratePhase1Sessions() {
  console.log('Starting migration from Phase 1 to Phase 2...');
  
  // This is a one-time migration script to convert existing sessions
  // to user accounts for users who want to upgrade
  
  const activeSessions = await SessionService.getAllActiveSessions();
  
  for (const session of activeSessions) {
    console.log(`Processing session: ${session.id}`);
    
    // Create a temporary user account
    const tempUser = await UserService.createTemporaryUser({
      email: `temp-${session.id}@forcemonitor.app`,
      orgId: session.orgId,
      instanceUrl: session.instanceUrl,
      accessToken: session.accessToken,
    });
    
    console.log(`Created temporary user: ${tempUser.id}`);
  }
  
  console.log('Migration completed!');
}
```

## Testing Strategy

### Database Tests
```typescript
// backend/src/tests/services/organizationService.test.ts
import { OrganizationService } from '../../services/organizationService';
import { UserService } from '../../services/userService';
import { DatabaseService } from '../../services/databaseService';

describe('OrganizationService', () => {
  let testUser;
  
  beforeEach(async () => {
    // Create test user
    testUser = await UserService.createUser({
      cognitoUserId: 'test-cognito-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });
  });

  afterEach(async () => {
    // Clean up test data
    await DatabaseService.query('DELETE FROM organizations WHERE user_id = $1', [testUser.id]);
    await DatabaseService.query('DELETE FROM users WHERE id = $1', [testUser.id]);
  });

  test('should create organization', async () => {
    const orgData = {
      userId: testUser.id,
      orgId: '00D000000000001',
      name: 'Test Org',
      instanceUrl: 'https://test.salesforce.com',
      accessToken: 'test-token',
    };

    const org = await OrganizationService.createOrganization(orgData);
    
    expect(org.id).toBeDefined();
    expect(org.name).toBe('Test Org');
    expect(org.isActive).toBe(true);
  });
});
```

## Deployment Checklist

### Phase 2 Deployment
- [ ] RDS PostgreSQL database deployed
- [ ] Database schema migrations applied
- [ ] Cognito User Pool configured
- [ ] Lambda polling function deployed
- [ ] EventBridge rule configured (30-min schedule)
- [ ] Environment variables updated
- [ ] Encryption keys configured for token storage
- [ ] Database connection pooling tested
- [ ] Historical data collection verified

### Security Updates
- [ ] Token encryption implemented
- [ ] Database credentials in Secrets Manager
- [ ] IAM roles with least privilege
- [ ] API rate limiting enabled
- [ ] Input validation on all endpoints

This Phase 2 implementation transforms your MVP into a full-featured SaaS platform with user accounts, persistent storage, and multi-org management capabilities.