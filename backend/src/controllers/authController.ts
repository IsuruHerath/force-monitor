import { Request, Response } from 'express';
import { SalesforceService } from '../services/salesforceService';
import { SessionService } from '../services/sessionService';

export class AuthController {
  
  // Step 1: Redirect to Salesforce OAuth
  static async initiateOAuth(req: Request, res: Response) {
    try {
      const environment = req.query.environment as 'production' | 'sandbox' || 'production';
      const authUrl = SalesforceService.getAuthorizationUrl(environment);
      res.json({ authUrl });
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
  }

  // Step 2: Handle OAuth callback
  static async handleCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
      }

      // Extract environment from state parameter (we'll add this to the auth URL)
      const environment = (state as string)?.startsWith('sandbox') ? 'sandbox' : 'production';

      // Exchange code for access token
      const tokenData = await SalesforceService.exchangeCodeForToken(code as string, environment);
      
      // Create session
      const sessionId = await SessionService.createSession({
        accessToken: tokenData.access_token,
        instanceUrl: tokenData.instance_url,
        orgId: tokenData.id.split('/').pop() || 'unknown'
      });

      // Redirect to dashboard with session
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?session=${sessionId}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: 'OAuth callback failed' });
    }
  }
}