import { PrismaClient } from '@prisma/client';
import { SalesforceService } from './salesforceService';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface CreateOrgData {
  userId: string;
  name: string;
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  orgId: string;
  environment: 'production' | 'sandbox';
}

interface UpdateOrgData {
  name?: string;
  isActive?: boolean;
}

export class OrganizationService {
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-32-character-key-for-dev';
  private static readonly ALGORITHM = 'aes-256-gcm';

  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.ENCRYPTION_KEY.slice(0, 32), 'utf8');
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const key = Buffer.from(this.ENCRYPTION_KEY.slice(0, 32), 'utf8');
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  static async createOrganization(orgData: CreateOrgData) {
    const { userId, name, accessToken, refreshToken, instanceUrl, orgId, environment } = orgData;

    // Check if user already has this org connected
    const existingOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_orgId: {
          userId,
          orgId
        }
      }
    });

    if (existingOrg) {
      // Update existing org instead of creating new one
      return await this.updateOrganizationTokens(existingOrg.id, {
        accessToken,
        refreshToken,
        instanceUrl
      });
    }

    // Encrypt sensitive data
    const encryptedAccessToken = this.encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? this.encrypt(refreshToken) : null;

    const organization = await prisma.userOrganization.create({
      data: {
        userId,
        name,
        orgId,
        instanceUrl,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        environment,
        lastSync: new Date()
      },
      select: {
        id: true,
        name: true,
        orgId: true,
        instanceUrl: true,
        environment: true,
        isActive: true,
        lastSync: true,
        createdAt: true
      }
    });

    return organization;
  }

  static async getUserOrganizations(userId: string) {
    const organizations = await prisma.userOrganization.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        orgId: true,
        instanceUrl: true,
        environment: true,
        isActive: true,
        lastSync: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return organizations;
  }

  static async getOrganizationById(orgId: string, userId: string) {
    const organization = await prisma.userOrganization.findFirst({
      where: {
        id: orgId,
        userId
      }
    });

    return organization;
  }

  static async getOrganizationWithTokens(orgId: string, userId: string) {
    const organization = await prisma.userOrganization.findFirst({
      where: {
        id: orgId,
        userId
      }
    });

    if (!organization) {
      return null;
    }

    // Decrypt tokens
    const accessToken = this.decrypt(organization.accessToken);
    const refreshToken = organization.refreshToken ? this.decrypt(organization.refreshToken) : null;

    return {
      ...organization,
      accessToken,
      refreshToken
    };
  }

  static async updateOrganization(orgId: string, userId: string, updateData: UpdateOrgData) {
    const updatedOrg = await prisma.userOrganization.update({
      where: {
        id: orgId,
        userId
      },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        orgId: true,
        environment: true,
        isActive: true,
        lastSync: true,
        updatedAt: true
      }
    });

    return updatedOrg;
  }

  static async updateOrganizationTokens(orgId: string, tokenData: {
    accessToken: string;
    refreshToken?: string;
    instanceUrl: string;
  }) {
    const { accessToken, refreshToken, instanceUrl } = tokenData;

    const encryptedAccessToken = this.encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? this.encrypt(refreshToken) : null;

    const updatedOrg = await prisma.userOrganization.update({
      where: { id: orgId },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        instanceUrl,
        lastSync: new Date(),
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        orgId: true,
        environment: true,
        isActive: true,
        lastSync: true
      }
    });

    return updatedOrg;
  }

  static async deleteOrganization(orgId: string, userId: string) {
    await prisma.userOrganization.delete({
      where: {
        id: orgId,
        userId
      }
    });

    return { message: 'Organization removed successfully' };
  }

  static async refreshOrganizationToken(orgId: string, userId: string) {
    const org = await this.getOrganizationWithTokens(orgId, userId);
    
    if (!org || !org.refreshToken) {
      throw new Error('Organization not found or no refresh token available');
    }

    try {
      // Use Salesforce service to refresh token
      const newTokens = await SalesforceService.refreshAccessToken(
        org.refreshToken,
        org.environment as 'production' | 'sandbox'
      );

      // Update organization with new tokens
      return await this.updateOrganizationTokens(orgId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || org.refreshToken,
        instanceUrl: newTokens.instance_url || org.instanceUrl
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('Failed to refresh organization token');
    }
  }

  static async getOrgLimitsWithRetry(orgId: string, userId: string) {
    const org = await this.getOrganizationWithTokens(orgId, userId);
    
    if (!org) {
      throw new Error('Organization not found');
    }

    try {
      // Try to get limits with current token
      const limits = await SalesforceService.getOrgLimits(org.accessToken, org.instanceUrl);
      
      // Update last sync time
      await prisma.userOrganization.update({
        where: { id: orgId },
        data: { lastSync: new Date() }
      });

      return limits;
    } catch (error: any) {
      // If token expired, try to refresh and retry
      if (error.message?.includes('token') || error.message?.includes('unauthorized')) {
        console.log('Token expired, attempting refresh...');
        
        try {
          await this.refreshOrganizationToken(orgId, userId);
          const refreshedOrg = await this.getOrganizationWithTokens(orgId, userId);
          
          if (refreshedOrg) {
            const limits = await SalesforceService.getOrgLimits(refreshedOrg.accessToken, refreshedOrg.instanceUrl);
            
            // Update last sync time
            await prisma.userOrganization.update({
              where: { id: orgId },
              data: { lastSync: new Date() }
            });

            return limits;
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
      
      throw error;
    }
  }
}