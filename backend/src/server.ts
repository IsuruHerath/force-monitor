import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRoutes } from './routes/authRoutes';
import { limitsRoutes } from './routes/limitsRoutes';
import { userRoutes } from './routes/userRoutes';
import { organizationRoutes } from './routes/organizationRoutes';
import { historyRoutes } from './routes/historyRoutes';
import { DatabaseService } from './services/databaseService';
import { SchedulerService } from './services/schedulerService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize scheduler service
const schedulerService = new SchedulerService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/api', limitsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/history', historyRoutes);

// Health check
app.get('/health', async (req, res) => {
  const dbHealth = await DatabaseService.healthCheck();
  res.json({ 
    status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbHealth
  });
});

// Initialize database connection and start server
async function startServer() {
  try {
    await DatabaseService.connect();
    
    // Start the scheduler for background tasks
    await schedulerService.start();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Background scheduler started for historical data collection');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Graceful shutdown...');
  await schedulerService.stop();
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  await schedulerService.stop();
  await DatabaseService.disconnect();
  process.exit(0);
});

startServer();