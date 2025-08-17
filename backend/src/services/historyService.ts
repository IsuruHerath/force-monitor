import { PrismaClient } from '@prisma/client';
import { SalesforceService } from './salesforceService';
import { OrganizationService } from './organizationService';

export class HistoryService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async collectHistoricalData(): Promise<void> {
    console.log('Starting historical data collection...');
    
    try {
      const activeOrganizations = await this.prisma.userOrganization.findMany({
        where: {
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      console.log(`Found ${activeOrganizations.length} active organizations to collect data for`);

      for (const org of activeOrganizations) {
        try {
          await this.collectDataForOrganization(org);
        } catch (error) {
          console.error(`Failed to collect data for organization ${org.name} (${org.orgId}):`, error);
        }
      }

      console.log('Historical data collection completed');
    } catch (error) {
      console.error('Error during historical data collection:', error);
      throw error;
    }
  }

  private async collectDataForOrganization(organization: any): Promise<void> {
    try {
      console.log(`Collecting data for organization: ${organization.name} (${organization.orgId})`);

      // Get fresh Salesforce limits data
      const limitsData = await OrganizationService.getOrgLimitsWithRetry(organization.id, organization.userId);

      // Extract key metrics for fast querying
      const extractedMetrics = this.extractKeyMetrics(limitsData);

      // Store the historical snapshot
      await this.prisma.orgLimitHistory.create({
        data: {
          organizationId: organization.id,
          orgId: organization.orgId,
          limitsData: limitsData,
          ...extractedMetrics,
        },
      });

      // Update the organization's lastSync timestamp
      await this.prisma.userOrganization.update({
        where: { id: organization.id },
        data: { lastSync: new Date() },
      });

      console.log(`Successfully collected data for organization: ${organization.name}`);
    } catch (error) {
      console.error(`Error collecting data for organization ${organization.name}:`, error);
      throw error;
    }
  }

  private extractKeyMetrics(limitsData: any): {
    apiRequestsUsed?: number;
    apiRequestsMax?: number;
    dataStorageUsed?: number;
    dataStorageMax?: number;
    fileStorageUsed?: number;
    fileStorageMax?: number;
    apiUsagePercentage?: number;
    dataUsagePercentage?: number;
    fileUsagePercentage?: number;
  } {
    const metrics: any = {};

    try {
      // Extract API request limits
      if (limitsData.DailyApiRequests) {
        metrics.apiRequestsUsed = limitsData.DailyApiRequests.Remaining !== undefined 
          ? limitsData.DailyApiRequests.Max - limitsData.DailyApiRequests.Remaining
          : undefined;
        metrics.apiRequestsMax = limitsData.DailyApiRequests.Max;
        
        if (metrics.apiRequestsUsed !== undefined && metrics.apiRequestsMax > 0) {
          metrics.apiUsagePercentage = (metrics.apiRequestsUsed / metrics.apiRequestsMax) * 100;
        }
      }

      // Extract data storage limits (convert to MB)
      if (limitsData.DataStorageMB) {
        metrics.dataStorageUsed = limitsData.DataStorageMB.Remaining !== undefined
          ? limitsData.DataStorageMB.Max - limitsData.DataStorageMB.Remaining
          : undefined;
        metrics.dataStorageMax = limitsData.DataStorageMB.Max;
        
        if (metrics.dataStorageUsed !== undefined && metrics.dataStorageMax > 0) {
          metrics.dataUsagePercentage = (metrics.dataStorageUsed / metrics.dataStorageMax) * 100;
        }
      }

      // Extract file storage limits (convert to MB)
      if (limitsData.FileStorageMB) {
        metrics.fileStorageUsed = limitsData.FileStorageMB.Remaining !== undefined
          ? limitsData.FileStorageMB.Max - limitsData.FileStorageMB.Remaining
          : undefined;
        metrics.fileStorageMax = limitsData.FileStorageMB.Max;
        
        if (metrics.fileStorageUsed !== undefined && metrics.fileStorageMax > 0) {
          metrics.fileUsagePercentage = (metrics.fileStorageUsed / metrics.fileStorageMax) * 100;
        }
      }
    } catch (error) {
      console.error('Error extracting key metrics:', error);
    }

    return metrics;
  }

  async getHistoricalData(
    organizationId: string,
    days: number = 30,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const historicalData = await this.prisma.orgLimitHistory.findMany({
        where: {
          organizationId,
          collectedAt: {
            gte: startDate,
          },
        },
        orderBy: {
          collectedAt: 'asc',
        },
      });

      // Group data by the requested granularity
      return this.groupDataByGranularity(historicalData, granularity);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
    }
  }

  private groupDataByGranularity(data: any[], granularity: 'hour' | 'day' | 'week'): any[] {
    if (granularity === 'hour') {
      // For hourly data, return as-is (or group by hour if needed)
      return data;
    }

    const grouped = new Map();

    for (const record of data) {
      let key: string;
      const date = new Date(record.collectedAt);

      if (granularity === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (granularity === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = date.toISOString();
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(record);
    }

    // Average the values for each group
    const result = [];
    for (const [key, records] of grouped.entries()) {
      const avgRecord = this.averageRecords(records, key);
      result.push(avgRecord);
    }

    return result.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());
  }

  private averageRecords(records: any[], dateKey: string): any {
    const count = records.length;
    if (count === 0) return null;

    const averaged = {
      collectedAt: dateKey,
      apiRequestsUsed: 0,
      apiRequestsMax: 0,
      dataStorageUsed: 0,
      dataStorageMax: 0,
      fileStorageUsed: 0,
      fileStorageMax: 0,
      apiUsagePercentage: 0,
      dataUsagePercentage: 0,
      fileUsagePercentage: 0,
    };

    for (const record of records) {
      averaged.apiRequestsUsed += record.apiRequestsUsed || 0;
      averaged.apiRequestsMax += record.apiRequestsMax || 0;
      averaged.dataStorageUsed += record.dataStorageUsed || 0;
      averaged.dataStorageMax += record.dataStorageMax || 0;
      averaged.fileStorageUsed += record.fileStorageUsed || 0;
      averaged.fileStorageMax += record.fileStorageMax || 0;
      averaged.apiUsagePercentage += record.apiUsagePercentage || 0;
      averaged.dataUsagePercentage += record.dataUsagePercentage || 0;
      averaged.fileUsagePercentage += record.fileUsagePercentage || 0;
    }

    // Calculate averages
    Object.keys(averaged).forEach(key => {
      if (key !== 'collectedAt') {
        (averaged as any)[key] = (averaged as any)[key] / count;
      }
    });

    return averaged;
  }

  async getTrendAnalysis(organizationId: string, days: number = 30): Promise<{
    apiTrend: string;
    dataTrend: string;
    fileTrend: string;
    growthRates: {
      api: number;
      data: number;
      file: number;
    };
  }> {
    try {
      // Try daily data first
      let historicalData = await this.getHistoricalData(organizationId, days, 'day');
      
      // If insufficient daily data, fall back to hourly data for recent period
      if (historicalData.length < 2) {
        console.log('Insufficient daily data, trying hourly data for trend analysis');
        historicalData = await this.getHistoricalData(organizationId, Math.min(days, 7), 'hour');
      }
      
      if (historicalData.length < 2) {
        return {
          apiTrend: 'insufficient_data',
          dataTrend: 'insufficient_data',
          fileTrend: 'insufficient_data',
          growthRates: { api: 0, data: 0, file: 0 },
        };
      }

      const firstRecord = historicalData[0];
      const lastRecord = historicalData[historicalData.length - 1];

      // Calculate growth rates
      const apiGrowth = this.calculateGrowthRate(
        firstRecord.apiUsagePercentage,
        lastRecord.apiUsagePercentage
      );
      const dataGrowth = this.calculateGrowthRate(
        firstRecord.dataUsagePercentage,
        lastRecord.dataUsagePercentage
      );
      const fileGrowth = this.calculateGrowthRate(
        firstRecord.fileUsagePercentage,
        lastRecord.fileUsagePercentage
      );

      return {
        apiTrend: this.determineTrend(apiGrowth),
        dataTrend: this.determineTrend(dataGrowth),
        fileTrend: this.determineTrend(fileGrowth),
        growthRates: {
          api: apiGrowth,
          data: dataGrowth,
          file: fileGrowth,
        },
      };
    } catch (error) {
      console.error('Error calculating trend analysis:', error);
      throw error;
    }
  }

  private calculateGrowthRate(initial: number, final: number): number {
    if (!initial && !final) return 0; // Both are zero/null
    if (!initial || initial === 0) {
      return final > 0 ? 100 : 0; // Started from zero, any value is 100% growth
    }
    return ((final - initial) / initial) * 100;
  }

  private determineTrend(growthRate: number): string {
    if (Math.abs(growthRate) < 5) return 'stable';
    return growthRate > 0 ? 'increasing' : 'decreasing';
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}