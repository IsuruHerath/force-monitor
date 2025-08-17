import { Request, Response } from 'express';
import { HistoryService } from '../services/historyService';
import { SchedulerService } from '../services/schedulerService';

export class HistoryController {
  private historyService: HistoryService;
  private schedulerService: SchedulerService;

  constructor() {
    this.historyService = new HistoryService();
    this.schedulerService = new SchedulerService();
  }

  async getHistoricalData(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { days = '30', granularity = 'day' } = req.query;

      // Validate granularity
      const validGranularities = ['hour', 'day', 'week'];
      if (!validGranularities.includes(granularity as string)) {
        res.status(400).json({
          error: 'Invalid granularity. Must be one of: hour, day, week'
        });
        return;
      }

      // Validate days
      const daysNumber = parseInt(days as string);
      if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
        res.status(400).json({
          error: 'Invalid days parameter. Must be between 1 and 365'
        });
        return;
      }

      const historicalData = await this.historyService.getHistoricalData(
        organizationId,
        daysNumber,
        granularity as 'hour' | 'day' | 'week'
      );

      res.json({
        success: true,
        data: historicalData,
        metadata: {
          organizationId,
          days: daysNumber,
          granularity,
          recordCount: historicalData.length
        }
      });
    } catch (error) {
      console.error('Error fetching historical data:', error);
      res.status(500).json({
        error: 'Failed to fetch historical data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTrendAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { days = '30' } = req.query;

      const daysNumber = parseInt(days as string);
      if (isNaN(daysNumber) || daysNumber < 7 || daysNumber > 365) {
        res.status(400).json({
          error: 'Invalid days parameter. Must be between 7 and 365 for trend analysis'
        });
        return;
      }

      const trendAnalysis = await this.historyService.getTrendAnalysis(
        organizationId,
        daysNumber
      );

      res.json({
        success: true,
        data: trendAnalysis,
        metadata: {
          organizationId,
          days: daysNumber,
          analysisDate: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating trend analysis:', error);
      res.status(500).json({
        error: 'Failed to generate trend analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async triggerDataCollection(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      
      if (organizationId) {
        // Collect data for specific organization
        // Note: This would require modifying the HistoryService to support single org collection
        res.status(501).json({
          error: 'Single organization data collection not yet implemented'
        });
        return;
      } else {
        // Trigger collection for all organizations
        await this.schedulerService.runImmediateDataCollection();
        
        res.json({
          success: true,
          message: 'Historical data collection triggered successfully'
        });
      }
    } catch (error) {
      console.error('Error triggering data collection:', error);
      res.status(500).json({
        error: 'Failed to trigger data collection',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCollectionStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.schedulerService.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting collection status:', error);
      res.status(500).json({
        error: 'Failed to get collection status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getDataSummary(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      
      // Get recent data points for summary
      const recentData = await this.historyService.getHistoricalData(organizationId, 7, 'day');
      const longerData = await this.historyService.getHistoricalData(organizationId, 30, 'day');
      
      if (recentData.length === 0) {
        res.json({
          success: true,
          data: {
            hasData: false,
            message: 'No historical data available for this organization'
          }
        });
        return;
      }

      const latest = recentData[recentData.length - 1];
      const summary = {
        hasData: true,
        latestCollection: latest.collectedAt,
        currentUsage: {
          api: latest.apiUsagePercentage || 0,
          data: latest.dataUsagePercentage || 0,
          file: latest.fileUsagePercentage || 0
        },
        dataPoints: {
          last7Days: recentData.length,
          last30Days: longerData.length
        },
        trends: await this.historyService.getTrendAnalysis(organizationId, 30)
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error generating data summary:', error);
      res.status(500).json({
        error: 'Failed to generate data summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}