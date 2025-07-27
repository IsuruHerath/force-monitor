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