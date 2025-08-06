import { Response } from 'express';
import { OrganizationService } from '../services/organizationService';
import { SalesforceService } from '../services/salesforceService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class OrganizationController {
  
  static async connectOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { code, state, name } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!code || !name) {
        return res.status(400).json({ 
          error: 'Authorization code and organization name are required' 
        });
      }

      // Extract environment from state parameter (format: "phase2-environment-uniqueId-timestamp-...")
      const stateParts = (state as string)?.split('-') || [];
      const environment = stateParts[1] === 'sandbox' ? 'sandbox' : 'production';
      
      console.log('Connect organization - State:', state);
      console.log('Connect organization - Environment:', environment);
      console.log('Connect organization - Code length:', code.length);

      // Exchange code for access token
      const tokenData = await SalesforceService.exchangeCodeForToken(code, environment);
      const orgId = tokenData.id.split('/').pop() || 'unknown';

      // Create organization record
      const organization = await OrganizationService.createOrganization({
        userId,
        name,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        instanceUrl: tokenData.instance_url,
        orgId,
        environment
      });

      res.status(201).json({
        message: 'Organization connected successfully',
        organization
      });
    } catch (error: any) {
      console.error('Connect organization error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: 'Organization already connected' });
      }
      
      res.status(500).json({ error: 'Failed to connect organization' });
    }
  }

  static async getOrganizations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const organizations = await OrganizationService.getUserOrganizations(userId);

      res.json({ organizations });
    } catch (error) {
      console.error('Get organizations error:', error);
      res.status(500).json({ error: 'Failed to get organizations' });
    }
  }

  static async getOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { orgId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const organization = await OrganizationService.getOrganizationById(orgId, userId);

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json({ organization });
    } catch (error) {
      console.error('Get organization error:', error);
      res.status(500).json({ error: 'Failed to get organization' });
    }
  }

  static async updateOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { orgId } = req.params;
      const { name, isActive } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;

      const organization = await OrganizationService.updateOrganization(
        orgId, 
        userId, 
        updateData
      );

      res.json({
        message: 'Organization updated successfully',
        organization
      });
    } catch (error) {
      console.error('Update organization error:', error);
      res.status(500).json({ error: 'Failed to update organization' });
    }
  }

  static async deleteOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { orgId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      await OrganizationService.deleteOrganization(orgId, userId);

      res.json({ message: 'Organization removed successfully' });
    } catch (error) {
      console.error('Delete organization error:', error);
      res.status(500).json({ error: 'Failed to remove organization' });
    }
  }

  static async getOrganizationLimits(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { orgId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const limits = await OrganizationService.getOrgLimitsWithRetry(orgId, userId);

      res.json(limits);
    } catch (error: any) {
      console.error('Get organization limits error:', error);
      
      if (error.message === 'Organization not found') {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      res.status(500).json({ error: 'Failed to get organization limits' });
    }
  }

  static async refreshOrganizationToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { orgId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const organization = await OrganizationService.refreshOrganizationToken(orgId, userId);

      res.json({
        message: 'Organization token refreshed successfully',
        organization
      });
    } catch (error: any) {
      console.error('Refresh token error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      res.status(500).json({ error: 'Failed to refresh organization token' });
    }
  }

  // Backwards compatibility endpoint for Phase 1 session-based access
  static async getLimitsLegacy(req: AuthenticatedRequest, res: Response) {
    try {
      const { session: sessionId, orgId } = req.query;
      const userId = req.user?.userId;

      // If authenticated user and orgId provided, use new multi-org approach
      if (userId && orgId) {
        const limits = await OrganizationService.getOrgLimitsWithRetry(orgId as string, userId);
        return res.json(limits);
      }

      // Fall back to Phase 1 session-based approach for backwards compatibility
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID or organization ID required' });
      }

      // This will be handled by the existing session service for backwards compatibility
      const SessionService = require('../services/sessionService').SessionService;
      const sessionData = await SessionService.getSession(sessionId as string);
      
      if (!sessionData) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      const limits = await SalesforceService.getOrgLimits(
        sessionData.accessToken, 
        sessionData.instanceUrl
      );

      await SessionService.extendSession(sessionId as string);
      res.json(limits);
    } catch (error) {
      console.error('Get limits legacy error:', error);
      res.status(500).json({ error: 'Failed to get organization limits' });
    }
  }
}