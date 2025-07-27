# Phase 3 Implementation Guide - Subscriptions & Production Ready

## Overview
Phase 3 transforms your application into a production-ready SaaS platform with subscription management, payment processing, email notifications, and enterprise-grade monitoring.

## Prerequisites
- Phase 2 completed with user accounts and multi-org support
- Users actively using historical data features
- Ready to monetize with subscription tiers

## Technical Architecture Additions

### New Components
- **Stripe Integration** - Payment processing and subscription management
- **AWS SES** - Email notifications and alerts
- **CloudWatch Alarms** - Advanced monitoring and alerting
- **WAF** - Web Application Firewall for security
- **CloudFront** - Global CDN for performance

### Subscription Tiers
```typescript
// Pricing tiers configuration
export const SUBSCRIPTION_TIERS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    maxOrgs: 0, // Session-based only
    features: ['Current status only', 'No historical data', '4-hour sessions'],
    stripePriceId: null,
  },
  STARTER: {
    id: 'starter',
    name: 'Starter',
    price: 29,
    maxOrgs: 3,
    features: ['Up to 3 orgs', 'Historical data', 'Basic alerts', 'Email notifications'],
    stripePriceId: 'price_starter_monthly',
  },
  PROFESSIONAL: {
    id: 'professional',
    name: 'Professional',
    price: 79,
    maxOrgs: 10,
    features: ['Up to 10 orgs', 'Advanced analytics', 'Custom alerts', 'Priority support'],
    stripePriceId: 'price_professional_monthly',
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    maxOrgs: -1, // Unlimited
    features: ['Unlimited orgs', 'API access', 'Custom integrations', 'Dedicated support'],
    stripePriceId: 'price_enterprise_monthly',
  },
};
```

## Implementation Steps

### Week 10-11: Stripe Integration & Subscription Management

#### Step 1: Database Schema for Subscriptions

**1.1 Add Subscription Tables**
```sql
-- Subscription plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  max_organizations INTEGER, -- NULL means unlimited
  stripe_price_id VARCHAR(255) UNIQUE,
  features JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_plan_id UUID REFERENCES subscription_plans(id),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL, -- active, canceled, past_due, etc.
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment history
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_payment_intent_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plans
INSERT INTO subscription_plans (name, price_monthly, max_organizations, stripe_price_id, features) VALUES
('Free', 0.00, 0, NULL, '["Current status only", "No historical data", "4-hour sessions"]'),
('Starter', 29.00, 3, 'price_starter_monthly', '["Up to 3 orgs", "Historical data", "Basic alerts", "Email notifications"]'),
('Professional', 79.00, 10, 'price_professional_monthly', '["Up to 10 orgs", "Advanced analytics", "Custom alerts", "Priority support"]'),
('Enterprise', 199.00, NULL, 'price_enterprise_monthly', '["Unlimited orgs", "API access", "Custom integrations", "Dedicated support"]');
```

#### Step 2: Stripe Service Implementation

**2.1 Stripe Service**
```typescript
// backend/src/services/stripeService.ts
import Stripe from 'stripe';
import { SubscriptionService } from './subscriptionService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class StripeService {
  
  static async createCustomer(userData: { email: string; name: string; userId: string }) {
    try {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.name,
        metadata: {
          userId: userData.userId,
        },
      });
      
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  static async createSubscription(customerId: string, priceId: string) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  static async createPaymentIntent(amount: number, customerId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency: 'usd',
        customer: customerId,
        automatic_payment_methods: { enabled: true },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  static async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  static async updateSubscription(subscriptionId: string, newPriceId: string) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      return updatedSubscription;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  static async retrieveSubscription(subscriptionId: string) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer'],
      });

      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw new Error('Failed to retrieve subscription');
    }
  }

  static async createBillingPortalSession(customerId: string, returnUrl: string) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw new Error('Failed to create billing portal session');
    }
  }

  static async handleWebhook(rawBody: string, signature: string) {
    try {
      const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }

  private static async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    await SubscriptionService.syncSubscriptionFromStripe(subscription);
  }

  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await SubscriptionService.cancelSubscription(subscription.id);
  }

  private static async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    if (invoice.subscription) {
      await SubscriptionService.recordPayment(
        invoice.subscription as string,
        invoice.amount_paid / 100,
        'succeeded'
      );
    }
  }

  private static async handlePaymentFailed(invoice: Stripe.Invoice) {
    if (invoice.subscription) {
      await SubscriptionService.recordPayment(
        invoice.subscription as string,
        invoice.amount_due / 100,
        'failed'
      );
    }
  }
}
```

**2.2 Subscription Service**
```typescript
// backend/src/services/subscriptionService.ts
import { DatabaseService } from './databaseService';
import { StripeService } from './stripeService';
import Stripe from 'stripe';

interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  maxOrganizations: number | null;
  stripePriceId: string | null;
  features: string[];
}

interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export class SubscriptionService {
  
  static async getAllPlans(): Promise<SubscriptionPlan[]> {
    const query = `
      SELECT id, name, price_monthly, max_organizations, stripe_price_id, features
      FROM subscription_plans 
      WHERE is_active = true
      ORDER BY price_monthly ASC
    `;
    
    const result = await DatabaseService.query(query);
    return result.rows.map(this.mapDbRowToPlan);
  }

  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const query = `
      SELECT id, user_id, subscription_plan_id, stripe_customer_id, stripe_subscription_id, 
             status, current_period_start, current_period_end, cancel_at_period_end
      FROM subscriptions 
      WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await DatabaseService.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToSubscription(result.rows[0]);
  }

  static async createSubscription(
    userId: string,
    planId: string,
    userEmail: string,
    userName: string
  ) {
    return await DatabaseService.transaction(async (client) => {
      // Get plan details
      const planQuery = 'SELECT * FROM subscription_plans WHERE id = $1';
      const planResult = await client.query(planQuery, [planId]);
      
      if (planResult.rows.length === 0) {
        throw new Error('Subscription plan not found');
      }
      
      const plan = planResult.rows[0];
      
      // Create Stripe customer
      const customer = await StripeService.createCustomer({
        email: userEmail,
        name: userName,
        userId,
      });
      
      // Create Stripe subscription
      const stripeSubscription = await StripeService.createSubscription(
        customer.id,
        plan.stripe_price_id
      );
      
      // Store subscription in database
      const subscriptionQuery = `
        INSERT INTO subscriptions 
        (user_id, subscription_plan_id, stripe_customer_id, stripe_subscription_id, 
         status, current_period_start, current_period_end)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const subscriptionResult = await client.query(subscriptionQuery, [
        userId,
        planId,
        customer.id,
        stripeSubscription.id,
        stripeSubscription.status,
        new Date(stripeSubscription.current_period_start * 1000),
        new Date(stripeSubscription.current_period_end * 1000),
      ]);
      
      return {
        subscriptionId: subscriptionResult.rows[0].id,
        clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret,
      };
    });
  }

  static async upgradeSubscription(userId: string, newPlanId: string) {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error('No active subscription found');
    }
    
    // Get new plan
    const planQuery = 'SELECT * FROM subscription_plans WHERE id = $1';
    const planResult = await DatabaseService.query(planQuery, [newPlanId]);
    
    if (planResult.rows.length === 0) {
      throw new Error('New subscription plan not found');
    }
    
    const newPlan = planResult.rows[0];
    
    // Update Stripe subscription
    const updatedStripeSubscription = await StripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      newPlan.stripe_price_id
    );
    
    // Update database
    const updateQuery = `
      UPDATE subscriptions 
      SET subscription_plan_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await DatabaseService.query(updateQuery, [newPlanId, subscription.id]);
    
    return updatedStripeSubscription;
  }

  static async cancelSubscription(subscriptionId: string) {
    const query = `
      UPDATE subscriptions 
      SET status = 'canceled', cancel_at_period_end = true, updated_at = CURRENT_TIMESTAMP
      WHERE stripe_subscription_id = $1
    `;
    
    await DatabaseService.query(query, [subscriptionId]);
  }

  static async syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription) {
    const query = `
      UPDATE subscriptions 
      SET status = $1, 
          current_period_start = $2, 
          current_period_end = $3,
          cancel_at_period_end = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE stripe_subscription_id = $5
    `;
    
    await DatabaseService.query(query, [
      stripeSubscription.status,
      new Date(stripeSubscription.current_period_start * 1000),
      new Date(stripeSubscription.current_period_end * 1000),
      stripeSubscription.cancel_at_period_end,
      stripeSubscription.id,
    ]);
  }

  static async recordPayment(
    stripeSubscriptionId: string,
    amount: number,
    status: string
  ) {
    const subscriptionQuery = `
      SELECT id FROM subscriptions WHERE stripe_subscription_id = $1
    `;
    
    const subscriptionResult = await DatabaseService.query(subscriptionQuery, [stripeSubscriptionId]);
    
    if (subscriptionResult.rows.length === 0) {
      console.error('Subscription not found for payment recording');
      return;
    }
    
    const paymentQuery = `
      INSERT INTO payments (subscription_id, amount, status, paid_at)
      VALUES ($1, $2, $3, $4)
    `;
    
    await DatabaseService.query(paymentQuery, [
      subscriptionResult.rows[0].id,
      amount,
      status,
      status === 'succeeded' ? new Date() : null,
    ]);
  }

  static async checkSubscriptionLimits(userId: string): Promise<{
    canAddOrganization: boolean;
    currentOrgCount: number;
    maxOrganizations: number | null;
    planName: string;
  }> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription) {
      // Free tier - no persistent orgs allowed
      return {
        canAddOrganization: false,
        currentOrgCount: 0,
        maxOrganizations: 0,
        planName: 'Free',
      };
    }
    
    // Get plan details
    const planQuery = 'SELECT * FROM subscription_plans WHERE id = $1';
    const planResult = await DatabaseService.query(planQuery, [subscription.planId]);
    const plan = planResult.rows[0];
    
    // Count current organizations
    const orgCountQuery = `
      SELECT COUNT(*) as count 
      FROM organizations 
      WHERE user_id = $1 AND is_active = true
    `;
    const orgCountResult = await DatabaseService.query(orgCountQuery, [userId]);
    const currentOrgCount = parseInt(orgCountResult.rows[0].count);
    
    const maxOrganizations = plan.max_organizations;
    const canAddOrganization = maxOrganizations === null || currentOrgCount < maxOrganizations;
    
    return {
      canAddOrganization,
      currentOrgCount,
      maxOrganizations,
      planName: plan.name,
    };
  }

  private static mapDbRowToPlan(row: any): SubscriptionPlan {
    return {
      id: row.id,
      name: row.name,
      priceMonthly: parseFloat(row.price_monthly),
      maxOrganizations: row.max_organizations,
      stripePriceId: row.stripe_price_id,
      features: row.features,
    };
  }

  private static mapDbRowToSubscription(row: any): UserSubscription {
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.subscription_plan_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
    };
  }
}
```

#### Step 3: Subscription Controllers

**3.1 Subscription Controller**
```typescript
// backend/src/controllers/subscriptionController.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { SubscriptionService } from '../services/subscriptionService';
import { StripeService } from '../services/stripeService';

export class SubscriptionController {
  
  static async getPlans(req: AuthenticatedRequest, res: Response) {
    try {
      const plans = await SubscriptionService.getAllPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
  }

  static async getCurrentSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const subscription = await SubscriptionService.getUserSubscription(req.user!.id);
      
      if (!subscription) {
        return res.json({ subscription: null, plan: 'free' });
      }

      res.json({ subscription });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  }

  static async createSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const { planId } = req.body;
      const user = req.user!;

      const result = await SubscriptionService.createSubscription(
        user.id,
        planId,
        user.email,
        `${user.firstName} ${user.lastName}`
      );

      res.json(result);
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  }

  static async upgradeSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const { planId } = req.body;
      const userId = req.user!.id;

      const updatedSubscription = await SubscriptionService.upgradeSubscription(userId, planId);
      
      res.json({ success: true, subscription: updatedSubscription });
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  }

  static async cancelSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const subscription = await SubscriptionService.getUserSubscription(req.user!.id);
      
      if (!subscription) {
        return res.status(404).json({ error: 'No subscription found' });
      }

      await StripeService.cancelSubscription(subscription.stripeSubscriptionId, true);
      
      res.json({ success: true, message: 'Subscription will be canceled at period end' });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }

  static async createBillingPortalSession(req: AuthenticatedRequest, res: Response) {
    try {
      const subscription = await SubscriptionService.getUserSubscription(req.user!.id);
      
      if (!subscription) {
        return res.status(404).json({ error: 'No subscription found' });
      }

      const session = await StripeService.createBillingPortalSession(
        subscription.stripeCustomerId,
        `${process.env.FRONTEND_URL}/account/billing`
      );
      
      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  }

  static async handleWebhook(req: any, res: Response) {
    try {
      const signature = req.headers['stripe-signature'];
      
      await StripeService.handleWebhook(req.body, signature);
      
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook handler failed' });
    }
  }

  static async checkLimits(req: AuthenticatedRequest, res: Response) {
    try {
      const limits = await SubscriptionService.checkSubscriptionLimits(req.user!.id);
      res.json(limits);
    } catch (error) {
      console.error('Error checking limits:', error);
      res.status(500).json({ error: 'Failed to check subscription limits' });
    }
  }
}
```

### Week 12: Email Notifications & Production Polish

#### Step 4: Email Notification Service

**4.1 Email Service with SES**
```typescript
// backend/src/services/emailService.ts
import { SES } from 'aws-sdk';
import { DatabaseService } from './databaseService';

const ses = new SES({ region: process.env.AWS_REGION || 'us-east-1' });

interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export class EmailService {
  
  static async sendAlertEmail(
    userEmail: string,
    userName: string,
    orgName: string,
    metricName: string,
    usagePercentage: number,
    threshold: number
  ) {
    const template = this.getAlertEmailTemplate(
      userName,
      orgName,
      metricName,
      usagePercentage,
      threshold
    );

    await this.sendEmail(userEmail, template);
  }

  static async sendWelcomeEmail(userEmail: string, userName: string) {
    const template = this.getWelcomeEmailTemplate(userName);
    await this.sendEmail(userEmail, template);
  }

  static async sendSubscriptionConfirmationEmail(
    userEmail: string,
    userName: string,
    planName: string,
    amount: number
  ) {
    const template = this.getSubscriptionConfirmationTemplate(userName, planName, amount);
    await this.sendEmail(userEmail, template);
  }

  private static async sendEmail(toEmail: string, template: EmailTemplate) {
    const params = {
      Source: process.env.FROM_EMAIL!, // Must be verified in SES
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Subject: {
          Data: template.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: template.htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: template.textBody,
            Charset: 'UTF-8',
          },
        },
      },
    };

    try {
      const result = await ses.sendEmail(params).promise();
      console.log('Email sent successfully:', result.MessageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  private static getAlertEmailTemplate(
    userName: string,
    orgName: string,
    metricName: string,
    usagePercentage: number,
    threshold: number
  ): EmailTemplate {
    const subject = `⚠️ ${orgName}: ${metricName} usage alert (${usagePercentage}%)`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Force Monitor Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #e74c3c;">⚠️ Salesforce Org Limit Alert</h2>
            
            <p>Hi ${userName},</p>
            
            <p>Your Salesforce organization <strong>${orgName}</strong> has reached a high usage level for <strong>${metricName}</strong>.</p>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">Alert Details:</h3>
              <ul style="margin-bottom: 0;">
                <li><strong>Metric:</strong> ${metricName}</li>
                <li><strong>Current Usage:</strong> ${usagePercentage}%</li>
                <li><strong>Alert Threshold:</strong> ${threshold}%</li>
                <li><strong>Organization:</strong> ${orgName}</li>
              </ul>
            </div>
            
            <p>We recommend taking action to avoid hitting your limits. Consider:</p>
            <ul>
              <li>Reviewing your current usage patterns</li>
              <li>Optimizing API calls or data usage</li>
              <li>Upgrading your Salesforce plan if needed</li>
            </ul>
            
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Dashboard
              </a>
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              You're receiving this because you have alerts enabled for this organization. 
              <a href="${process.env.FRONTEND_URL}/settings/notifications">Manage your notification preferences</a>
            </p>
          </div>
        </body>
      </html>
    `;
    
    const textBody = `
      Salesforce Org Limit Alert
      
      Hi ${userName},
      
      Your Salesforce organization "${orgName}" has reached a high usage level for "${metricName}".
      
      Alert Details:
      - Metric: ${metricName}
      - Current Usage: ${usagePercentage}%
      - Alert Threshold: ${threshold}%
      - Organization: ${orgName}
      
      We recommend taking action to avoid hitting your limits.
      
      View your dashboard: ${process.env.FRONTEND_URL}/dashboard
    `;

    return { subject, htmlBody, textBody };
  }

  private static getWelcomeEmailTemplate(userName: string): EmailTemplate {
    const subject = 'Welcome to Force Monitor! 🎉';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Force Monitor</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3498db;">Welcome to Force Monitor! 🎉</h2>
            
            <p>Hi ${userName},</p>
            
            <p>Thanks for signing up! You're now ready to monitor your Salesforce organization limits and never be surprised by hitting your limits again.</p>
            
            <h3>Getting Started:</h3>
            <ol>
              <li><strong>Connect your first organization</strong> - Add your Salesforce org to start monitoring</li>
              <li><strong>Set up alerts</strong> - Get notified when usage reaches your thresholds</li>
              <li><strong>Explore historical data</strong> - See how your usage changes over time</li>
            </ol>
            
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Get Started
              </a>
            </p>
            
            <p>If you have any questions, just reply to this email or check out our <a href="${process.env.FRONTEND_URL}/help">help center</a>.</p>
            
            <p>Happy monitoring!<br>The Force Monitor Team</p>
          </div>
        </body>
      </html>
    `;
    
    const textBody = `
      Welcome to Force Monitor!
      
      Hi ${userName},
      
      Thanks for signing up! You're now ready to monitor your Salesforce organization limits.
      
      Getting Started:
      1. Connect your first organization
      2. Set up alerts  
      3. Explore historical data
      
      Get started: ${process.env.FRONTEND_URL}/dashboard
    `;

    return { subject, htmlBody, textBody };
  }

  private static getSubscriptionConfirmationTemplate(
    userName: string,
    planName: string,
    amount: number
  ): EmailTemplate {
    const subject = `Subscription confirmed - ${planName} plan`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Subscription Confirmed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #27ae60;">✅ Subscription Confirmed</h2>
            
            <p>Hi ${userName},</p>
            
            <p>Your subscription to the <strong>${planName}</strong> plan has been confirmed!</p>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #155724;">Subscription Details:</h3>
              <ul style="margin-bottom: 0;">
                <li><strong>Plan:</strong> ${planName}</li>
                <li><strong>Amount:</strong> $${amount}/month</li>
                <li><strong>Billing:</strong> Monthly</li>
              </ul>
            </div>
            
            <p>You now have access to all the features included in your plan. Start exploring your enhanced monitoring capabilities!</p>
            
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" 
                 style="background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Go to Dashboard
              </a>
            </p>
            
            <p>Questions about your subscription? <a href="${process.env.FRONTEND_URL}/account/billing">Manage your billing</a> or contact our support team.</p>
          </div>
        </body>
      </html>
    `;
    
    const textBody = `
      Subscription Confirmed
      
      Hi ${userName},
      
      Your subscription to the ${planName} plan has been confirmed!
      
      Plan: ${planName}
      Amount: $${amount}/month
      Billing: Monthly
      
      Go to dashboard: ${process.env.FRONTEND_URL}/dashboard
    `;

    return { subject, htmlBody, textBody };
  }
}
```

#### Step 5: Alert System

**5.1 Alert Service**
```typescript
// backend/src/services/alertService.ts
import { DatabaseService } from './databaseService';
import { EmailService } from './emailService';
import { UserService } from './userService';

interface Alert {
  id: string;
  organizationId: string;
  metricName: string;
  thresholdPercentage: number;
  isActive: boolean;
}

export class AlertService {
  
  static async createAlert(
    organizationId: string,
    metricName: string,
    thresholdPercentage: number
  ): Promise<Alert> {
    const query = `
      INSERT INTO alerts (organization_id, metric_name, threshold_percentage)
      VALUES ($1, $2, $3)
      RETURNING id, organization_id, metric_name, threshold_percentage, is_active
    `;
    
    const result = await DatabaseService.query(query, [
      organizationId,
      metricName,
      thresholdPercentage,
    ]);
    
    return this.mapDbRowToAlert(result.rows[0]);
  }

  static async getOrganizationAlerts(organizationId: string): Promise<Alert[]> {
    const query = `
      SELECT id, organization_id, metric_name, threshold_percentage, is_active
      FROM alerts 
      WHERE organization_id = $1 AND is_active = true
      ORDER BY threshold_percentage DESC
    `;
    
    const result = await DatabaseService.query(query, [organizationId]);
    return result.rows.map(this.mapDbRowToAlert);
  }

  static async checkAlertsForMetric(
    organizationId: string,
    metricName: string,
    currentUsagePercentage: number
  ) {
    const alerts = await this.getOrganizationAlerts(organizationId);
    
    const triggeredAlerts = alerts.filter(
      alert => alert.metricName === metricName && 
               currentUsagePercentage >= alert.thresholdPercentage
    );

    if (triggeredAlerts.length > 0) {
      await this.sendAlertNotifications(organizationId, metricName, currentUsagePercentage, triggeredAlerts);
    }
  }

  private static async sendAlertNotifications(
    organizationId: string,
    metricName: string,
    usagePercentage: number,
    alerts: Alert[]
  ) {
    try {
      // Get organization and user details
      const orgQuery = `
        SELECT o.name as org_name, u.email, u.first_name, u.last_name
        FROM organizations o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `;
      
      const orgResult = await DatabaseService.query(orgQuery, [organizationId]);
      
      if (orgResult.rows.length === 0) {
        console.error('Organization not found for alert notification');
        return;
      }
      
      const { org_name, email, first_name, last_name } = orgResult.rows[0];
      const userName = `${first_name} ${last_name}`;
      
      // Send email for the highest threshold alert (most severe)
      const highestAlert = alerts.reduce((max, alert) => 
        alert.thresholdPercentage > max.thresholdPercentage ? alert : max
      );
      
      await EmailService.sendAlertEmail(
        email,
        userName,
        org_name,
        metricName,
        usagePercentage,
        highestAlert.thresholdPercentage
      );
      
      console.log(`Alert sent for ${org_name}: ${metricName} at ${usagePercentage}%`);
    } catch (error) {
      console.error('Error sending alert notifications:', error);
    }
  }

  static async updateAlert(
    alertId: string,
    thresholdPercentage?: number,
    isActive?: boolean
  ) {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (thresholdPercentage !== undefined) {
      updates.push(`threshold_percentage = $${paramIndex++}`);
      values.push(thresholdPercentage);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(alertId);

    const query = `
      UPDATE alerts 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await DatabaseService.query(query, values);
  }

  static async deleteAlert(alertId: string) {
    const query = 'DELETE FROM alerts WHERE id = $1';
    await DatabaseService.query(query, [alertId]);
  }

  private static mapDbRowToAlert(row: any): Alert {
    return {
      id: row.id,
      organizationId: row.organization_id,
      metricName: row.metric_name,
      thresholdPercentage: row.threshold_percentage,
      isActive: row.is_active,
    };
  }
}
```

#### Step 6: Production Monitoring & Security

**6.1 CloudWatch Monitoring Setup**
```typescript
// infrastructure/lib/monitoring-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export class MonitoringStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SNS Topic for alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: 'Force Monitor Alerts',
    });

    // Subscribe email to alerts
    alertTopic.addSubscription(
      new subscriptions.EmailSubscription(process.env.ALERT_EMAIL || 'alerts@forcemonitor.com')
    );

    // Application Error Rate Alarm
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          LoadBalancer: 'app/force-monitor-alb/1234567890123456',
        },
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'High error rate detected',
    });

    errorRateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));

    // Database Connection Alarm
    const dbConnectionAlarm = new cloudwatch.Alarm(this, 'DatabaseConnectionAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: 'force-monitor-db',
        },
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'High database connections',
    });

    dbConnectionAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));

    // Lambda Error Rate
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: 'force-monitor-polling',
        },
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda polling function errors',
    });

    lambdaErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));
  }
}
```

**6.2 WAF Configuration**
```typescript
// infrastructure/lib/security-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export class SecurityStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // WAF Web ACL
    const webAcl = new wafv2.CfnWebACL(this, 'ForceMonitorWAF', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSetMetric',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'ForceMonitorWAF',
      },
    });
  }
}
```

## Frontend Implementation

### Subscription Management UI

**Pricing Page Component**
```typescript
// frontend/src/pages/PricingPage.tsx
import React, { useState, useEffect } from 'react';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { subscriptionService } from '../services/subscriptionService';

export const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const plansData = await subscriptionService.getPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading plans...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start with our free tier and upgrade as your monitoring needs grow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <SubscriptionCard key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">All plans include:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <span className="bg-white px-3 py-1 rounded-full">✅ 30-minute polling</span>
            <span className="bg-white px-3 py-1 rounded-full">✅ SSL encryption</span>
            <span className="bg-white px-3 py-1 rounded-full">✅ 99.9% uptime SLA</span>
            <span className="bg-white px-3 py-1 rounded-full">✅ Email support</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Deployment Strategy

### Blue-Green Deployment
```typescript
// scripts/deploy.ts
import { ECS } from 'aws-sdk';

export class DeploymentService {
  private ecs = new ECS();

  async deployNewVersion(serviceName: string, taskDefinitionArn: string) {
    console.log('Starting blue-green deployment...');
    
    // Update service with new task definition
    await this.ecs.updateService({
      cluster: 'force-monitor-cluster',
      service: serviceName,
      taskDefinition: taskDefinitionArn,
      deploymentConfiguration: {
        maximumPercent: 200,
        minimumHealthyPercent: 50,
      },
    }).promise();

    console.log('Deployment initiated, monitoring health...');
    
    // Wait for deployment to complete
    await this.waitForDeploymentCompletion(serviceName);
    
    console.log('Deployment completed successfully!');
  }

  private async waitForDeploymentCompletion(serviceName: string) {
    let attempts = 0;
    const maxAttempts = 30; // 15 minutes max
    
    while (attempts < maxAttempts) {
      const service = await this.ecs.describeServices({
        cluster: 'force-monitor-cluster',
        services: [serviceName],
      }).promise();
      
      const deployments = service.services![0].deployments!;
      const primaryDeployment = deployments.find(d => d.status === 'PRIMARY');
      
      if (primaryDeployment && primaryDeployment.runningCount === primaryDeployment.desiredCount) {
        return; // Deployment complete
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      attempts++;
    }
    
    throw new Error('Deployment timeout');
  }
}
```

## Production Checklist

### Security
- [ ] WAF rules configured and tested
- [ ] SSL certificates installed
- [ ] Database encryption at rest enabled
- [ ] Secrets stored in AWS Secrets Manager
- [ ] IAM roles follow least privilege principle
- [ ] API rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] CORS properly configured

### Performance
- [ ] CloudFront CDN configured
- [ ] Database connection pooling optimized
- [ ] Redis caching strategy implemented
- [ ] Lambda cold start optimizations
- [ ] Database queries optimized with indexes
- [ ] Frontend bundle size optimized

### Monitoring
- [ ] CloudWatch alarms configured
- [ ] Application logging implemented
- [ ] Error tracking (Sentry/CloudWatch)
- [ ] Performance monitoring
- [ ] Database monitoring
- [ ] Lambda function monitoring

### Payments & Compliance
- [ ] Stripe webhook endpoints secured
- [ ] PCI compliance requirements met
- [ ] GDPR compliance for EU users
- [ ] Terms of service and privacy policy
- [ ] Billing portal tested
- [ ] Subscription lifecycle tested

This Phase 3 implementation completes your SaaS platform with enterprise-grade features, making it ready for production use and revenue generation.