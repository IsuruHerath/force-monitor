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
  
  static getAuthorizationUrl(environment: 'production' | 'sandbox' = 'production'): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
      scope: 'api id',
      state: environment
    });
    
    const baseUrl = environment === 'sandbox' 
      ? 'https://test.salesforce.com' 
      : 'https://login.salesforce.com';
    
    return `${baseUrl}/services/oauth2/authorize?${params}`;
  }

  static async exchangeCodeForToken(code: string, environment: 'production' | 'sandbox' = 'production'): Promise<TokenResponse> {
    try {
      const baseUrl = environment === 'sandbox' 
        ? 'https://test.salesforce.com' 
        : 'https://login.salesforce.com';
      
      const response = await axios.post(`${baseUrl}/services/oauth2/token`, 
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
    } catch (error: any) {
      console.error('Error exchanging code for token:', error.response?.data || error.message || error);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
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
      console.error('Error fetching org limits:', error);
      throw new Error('Failed to fetch org limits');
    }
  }
}