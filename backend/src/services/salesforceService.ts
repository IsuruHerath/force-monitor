import axios from 'axios';

interface TokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  signature: string;
  scope: string;
  token_type: string;
  refresh_token?: string;
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
      scope: 'api id refresh_token',
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
      
      console.log('Exchanging code for token:', {
        baseUrl,
        environment,
        codeLength: code.length,
        codePrefix: code.substring(0, 10) + '...',
        clientId: process.env.SALESFORCE_CLIENT_ID?.substring(0, 10) + '...',
        redirectUri: process.env.SALESFORCE_REDIRECT_URI,
        timestamp: new Date().toISOString()
      });
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SALESFORCE_CLIENT_ID!,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
        redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
        code
      });
      
      console.log('Request params (without secrets):', {
        grant_type: 'authorization_code',
        client_id: process.env.SALESFORCE_CLIENT_ID?.substring(0, 10) + '...',
        redirect_uri: process.env.SALESFORCE_REDIRECT_URI,
        code: code.substring(0, 10) + '...'
      });
      
      const response = await axios.post(`${baseUrl}/services/oauth2/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('Token exchange successful:', {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        instanceUrl: response.data.instance_url
      });
      
      return response.data;
    } catch (error: any) {
      console.error('DETAILED Token exchange error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  static async refreshAccessToken(refreshToken: string, environment: 'production' | 'sandbox' = 'production'): Promise<TokenResponse> {
    try {
      const baseUrl = environment === 'sandbox' 
        ? 'https://test.salesforce.com' 
        : 'https://login.salesforce.com';
      
      const response = await axios.post(`${baseUrl}/services/oauth2/token`, 
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.SALESFORCE_CLIENT_ID!,
          client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Error refreshing token:', error.response?.data || error.message || error);
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
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