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

  // Step 2: Handle OAuth callback (supports both Phase 1 and Phase 2)
  static async handleCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query;
      
      console.log('OAuth callback received:', { code: !!code, state });
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
      }

      // Check if this is Phase 2 (new user account flow)
      if ((state as string)?.startsWith('phase2-')) {
        console.log('Handling Phase 2 OAuth callback');
        // Phase 2: Redirect to frontend with code for user to handle
        const encodedState = encodeURIComponent(state as string);
        const encodedCode = encodeURIComponent(code as string);
        return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?code=${encodedCode}&state=${encodedState}`);
      }

      // Phase 1: Legacy session-based flow (state is just "sandbox" or "production")
      console.log('Handling Phase 1 OAuth callback');
      const environment = (state as string) === 'sandbox' ? 'sandbox' : 'production';

      // Exchange code for access token
      const tokenData = await SalesforceService.exchangeCodeForToken(code as string, environment);
      
      // Create session (backwards compatibility for Phase 1)
      const sessionId = await SessionService.createSession({
        accessToken: tokenData.access_token,
        instanceUrl: tokenData.instance_url,
        orgId: tokenData.id.split('/').pop() || 'unknown'
      });

      console.log('Phase 1 session created:', sessionId);
      const redirectUrl = `${process.env.FRONTEND_URL}/dashboard?session=${sessionId}`;
      console.log('Redirecting to:', redirectUrl);

      // Redirect to dashboard with session
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: 'OAuth callback failed' });
    }
  }

  // New Phase 2 OAuth initiation for organization connection
  static async initiateOrgConnection(req: Request, res: Response) {
    try {
      const environment = req.query.environment as 'production' | 'sandbox' || 'production';
      const redirectPath = req.query.redirect || '/organizations/connect';
      
      // Generate unique identifier for this OAuth request to prevent conflicts
      const uniqueId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      
      // Use a unique state parameter for each connection attempt
      const state = `phase2-${environment}-${uniqueId}-${timestamp}-${Buffer.from(redirectPath as string).toString('base64')}`;
      
      console.log('Initiating org connection OAuth:', {
        environment,
        uniqueId,
        timestamp,
        state: state.substring(0, 50) + '...'
      });
      
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.SALESFORCE_CLIENT_ID!,
        redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
        scope: 'api id refresh_token',
        state,
        prompt: 'login' // Force login screen to allow connecting different orgs
      });
      
      const baseUrl = environment === 'sandbox' 
        ? 'https://test.salesforce.com' 
        : 'https://login.salesforce.com';
      
      const authUrl = `${baseUrl}/services/oauth2/authorize?${params}`;
      res.json({ authUrl });
    } catch (error) {
      console.error('Error initiating org connection OAuth:', error);
      res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
  }
}