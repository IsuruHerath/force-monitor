# Salesforce Org Monitoring SaaS - Implementation Plan

## Project Overview

A SaaS application for managed services companies to monitor multiple Salesforce orgs using the `/services/data/v62.0/limits` API. The system polls every 30 minutes, stores historical data, and provides real-time dashboards with charts and graphs.

### Business Model
- **Free Tier**: Instant access via Salesforce OAuth, current status only, no registration required
- **Paid Tier**: User accounts, historical data, multiple orgs, per-org pricing model
- **Future Add-on**: Configurable polling frequency

## Technology Stack

### Backend
- **Node.js + Express** - API development
- **PostgreSQL** - Primary database for time-series data
- **Redis** - Caching and session management
- **JWT** - Authentication

### Frontend
- **React + TypeScript** - Web application
- **Chart.js/Recharts** - Data visualization
- **Tailwind CSS** - Styling

### Infrastructure (AWS)
- **Docker** - Containerization
- **AWS** - Cloud hosting platform
- **Stripe** - Payment processing
- **OAuth 2.0** - Salesforce authentication

## AWS Architecture Design

### Core AWS Services
- **API Gateway** - REST API endpoints with rate limiting
- **Lambda** - Salesforce polling functions (30-min scheduled)
- **EventBridge** - Reliable job scheduling 
- **RDS PostgreSQL** - Time-series metrics storage
- **ElastiCache Redis** - Session management & caching
- **Cognito** - User authentication
- **S3** - Static assets, backups
- **CloudFront** - CDN for dashboard
- **ECS Fargate** - Containerized web application

### Key Benefits
- EventBridge guarantees scheduled execution (critical for monitoring)
- Lambda auto-scales per organization
- RDS automated backups and read replicas
- Cognito handles OAuth flows with Salesforce

## AWS Infrastructure Setup Plan

### Phase 1 - Foundation (MVP)
1. **VPC Setup** - Private/public subnets, NAT gateway
2. **ElastiCache Redis** - Session management for temporary access
3. **S3 Buckets** - Static assets, logs
4. **Lambda Functions** - Salesforce polling on-demand

### Phase 2 - User Accounts & Persistence
1. **RDS PostgreSQL** - Historical data storage
2. **Cognito User Pool** - User registration and authentication
3. **EventBridge Rules** - 30-minute cron expressions per org
4. **API Gateway** - REST endpoints with JWT validation
5. **Multi-org management** - User-org relationships

### Phase 3 - Production & Payments
1. **CloudWatch** - Logs, metrics, alarms
2. **WAF** - API protection
3. **Secrets Manager** - Salesforce credentials
4. **Stripe Integration** - Payment processing
5. **CloudFront** - CDN distribution

## Development Workflow

### Infrastructure as Code
- **Terraform** or **AWS CDK** - Reproducible deployments
- **CloudFormation** - AWS native infrastructure management
- **GitHub Actions** - CI/CD with AWS integration

### Development Pipeline
1. **Local Development** - Docker Compose with LocalStack
2. **Dev Environment** - Dedicated AWS account/region
3. **Staging** - Production-like setup for testing
4. **Production** - Multi-AZ, auto-scaling enabled

### Deployment Strategy
- **Blue/Green Deployments** - Zero downtime updates
- **Lambda Versioning** - Gradual rollouts for polling functions
- **Database Migrations** - Automated with rollback capability

## Implementation Timeline & Effort

### Total Estimated Timeline: 3-3.5 months  
### Total Development Effort: 320-400 hours

### Phase 1 (3-4 weeks) - MVP (No Registration)
**Deliverables:**
- Salesforce OAuth integration with temporary sessions
- Live limits API polling (on-demand)
- Simple dashboard (current status only)
- Session-based access (2-4 hour expiry)

**Milestones:**
- Milestone 1: Salesforce OAuth + session management (Week 1-2)
- Milestone 2: Live dashboard + limits API integration (Week 3)
- Milestone 3: Polish + deployment (Week 4)

**Effort:** ~100-120 hours

### Phase 2 (3-4 weeks) - User Accounts & Multi-Org
**Deliverables:**
- User registration and authentication
- Multi-org management (live data only)
- Live multi-org dashboard
- Account management

**Milestones:**
- Milestone 4: User accounts + database setup (Week 5-6)
- Milestone 5: Multi-org support + live polling (Week 7-8)
- Milestone 6: Multi-org dashboard + account management (Week 9)

**Effort:** ~100-120 hours

### Phase 3 (3-4 weeks) - Subscriptions & Historical Data
**Deliverables:**
- Subscription tiers and management
- Payment integration (Stripe)
- Historical data tracking and storage
- Time-series charts and analytics
- Automated polling and alerts
- Email notifications
- Performance optimization

**Milestones:**
- Milestone 7: Subscription management + Stripe integration (Week 10-11)
- Milestone 8: Historical data + automated polling (Week 12)
- Milestone 9: Analytics + alerts + production polish (Week 13)

**Effort:** ~120-160 hours

## Database Schema

### Phase 1 - No Database (Session-based)
- **Redis Sessions** - Temporary access tokens and org data
- **In-memory storage** - Current limits data only

### Phase 2+ - Persistent Storage
- **Users** - User accounts and authentication
- **Organizations** - Salesforce org configurations
- **Subscriptions** - Payment and tier management
- **Metrics** - Time-series data (org_id, metric_name, max_value, remaining_value, timestamp)
- **Alerts** - Notification configurations

### Sample Metrics Data Structure
```json
{
  "org_id": "00D000000000001",
  "timestamp": "2025-07-26T10:19:28Z",
  "metrics": {
    "DailyApiRequests": {
      "Max": 101002,
      "Remaining": 100998
    },
    "DataStorageMB": {
      "Max": 200,
      "Remaining": 200
    }
  }
}
```

## AWS Cost Analysis & Scaling

### MVP Phase (No database)
- Lambda: $5/month (on-demand executions)
- ECS Fargate: $15/month (0.25 vCPU)
- ElastiCache: $13/month
- Other services: $10/month
- **Total: ~$43/month**

### Startup Phase (0-50 orgs)
- RDS db.t3.micro: $13/month
- Lambda: $5/month (48 executions/day)
- ECS Fargate: $15/month (0.25 vCPU)
- ElastiCache: $13/month
- Other services: $10/month
- **Total: ~$56/month**

### Growth Phase (100-500 orgs)
- RDS db.t3.small: $25/month
- Lambda: $15/month (scaling)
- ECS Fargate: $30/month (auto-scaling)
- ElastiCache cluster: $35/month
- CloudFront, S3: $20/month
- **Total: ~$125/month**

### Scale Phase (1000+ orgs)
- RDS Multi-AZ: $100/month
- Lambda: $50/month
- ECS cluster: $80/month
- ElastiCache: $60/month
- Additional services: $50/month
- **Total: ~$340/month**

### Revenue Model Validation
At $10/org/month with 100 orgs = $1,000 revenue vs $125 AWS costs = **87.5% gross margin**

## Budget Estimate

### Development Costs
- **Senior Developer**: $80-120/hour × 320-400 hours = **$25,600-48,000**
- **Infrastructure**: $200-500/month  
- **Third-party services**: $100-300/month

### Key AWS Advantages

1. **Reliability**: EventBridge + Lambda ensures 99.99% uptime for critical Salesforce polling
2. **Cost Efficiency**: Pay-per-use Lambda scaling means costs grow with revenue
3. **Global Scale**: Easy expansion to serve international MSPs
4. **Security**: Built-in compliance (SOC 2, GDPR) for enterprise customers
5. **Integration**: Native Salesforce connectors and marketplace presence

## Key Implementation Considerations

- Start with proper API rate limiting for Salesforce calls
- Implement webhook notifications for critical thresholds
- Plan for horizontal scaling as customer base grows
- Use managed PostgreSQL service for easier scaling
- Ensure proper monitoring and alerting from day one

## Next Steps

1. Set up AWS Free Tier account
2. Create Terraform/CDK infrastructure templates
3. Implement MVP on AWS with proper monitoring from day one
4. Plan gradual feature rollout using AWS deployment tools

This AWS architecture provides enterprise-grade reliability while maintaining startup-friendly costs and scaling smoothly with customer growth.