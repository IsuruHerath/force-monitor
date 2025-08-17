import cron from 'node-cron';
import { HistoryService } from './historyService';
import { AlertService } from './alertService';
import { AnalyticsService } from './analyticsService';

export class SchedulerService {
  private historyService: HistoryService;
  private alertService: AlertService | null = null;
  private analyticsService: AnalyticsService | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.historyService = new HistoryService();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Scheduler service is already running');
      return;
    }

    console.log('Starting scheduler service...');
    this.isRunning = true;

    // Schedule historical data collection every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Running scheduled historical data collection...');
      try {
        await this.historyService.collectHistoricalData();
        console.log('Scheduled historical data collection completed');
      } catch (error) {
        console.error('Error in scheduled historical data collection:', error);
      }
    });

    // Schedule alert processing every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      if (this.alertService) {
        console.log('Running scheduled alert processing...');
        try {
          await this.alertService.processAlerts();
          console.log('Scheduled alert processing completed');
        } catch (error) {
          console.error('Error in scheduled alert processing:', error);
        }
      }
    });

    // Schedule daily analytics snapshot at 2 AM
    cron.schedule('0 2 * * *', async () => {
      if (this.analyticsService) {
        console.log('Running scheduled daily analytics snapshot...');
        try {
          await this.analyticsService.generateDailySnapshots();
          console.log('Scheduled daily analytics snapshot completed');
        } catch (error) {
          console.error('Error in scheduled daily analytics snapshot:', error);
        }
      }
    });

    // Schedule weekly analytics snapshot on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      if (this.analyticsService) {
        console.log('Running scheduled weekly analytics snapshot...');
        try {
          await this.analyticsService.generateWeeklySnapshots();
          console.log('Scheduled weekly analytics snapshot completed');
        } catch (error) {
          console.error('Error in scheduled weekly analytics snapshot:', error);
        }
      }
    });

    console.log('Scheduler service started successfully');
    console.log('- Historical data collection: Every hour');
    console.log('- Alert processing: Every 15 minutes');
    console.log('- Daily analytics: 2:00 AM daily');
    console.log('- Weekly analytics: 3:00 AM on Sundays');
  }

  setAlertService(alertService: AlertService): void {
    this.alertService = alertService;
  }

  setAnalyticsService(analyticsService: AnalyticsService): void {
    this.analyticsService = analyticsService;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Scheduler service is not running');
      return;
    }

    console.log('Stopping scheduler service...');
    this.isRunning = false;
    
    // Note: node-cron doesn't provide a direct way to stop all tasks
    // In a production environment, you might want to store task references
    // and call destroy() on each task
    
    await this.historyService.cleanup();
    console.log('Scheduler service stopped');
  }

  async runImmediateDataCollection(): Promise<void> {
    console.log('Running immediate historical data collection...');
    try {
      await this.historyService.collectHistoricalData();
      console.log('Immediate historical data collection completed');
    } catch (error) {
      console.error('Error in immediate historical data collection:', error);
      throw error;
    }
  }

  getStatus(): {
    isRunning: boolean;
    services: {
      history: boolean;
      alerts: boolean;
      analytics: boolean;
    };
  } {
    return {
      isRunning: this.isRunning,
      services: {
        history: true,
        alerts: this.alertService !== null,
        analytics: this.analyticsService !== null,
      },
    };
  }
}