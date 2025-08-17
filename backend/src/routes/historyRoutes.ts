import { Router } from 'express';
import { HistoryController } from '../controllers/historyController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const historyController = new HistoryController();

// Apply authentication middleware to all history routes
router.use(authenticateToken);

// Get historical data for an organization
router.get('/organizations/:organizationId/history', (req, res) => {
  historyController.getHistoricalData(req, res);
});

// Get trend analysis for an organization
router.get('/organizations/:organizationId/trends', (req, res) => {
  historyController.getTrendAnalysis(req, res);
});

// Get data summary for an organization
router.get('/organizations/:organizationId/summary', (req, res) => {
  historyController.getDataSummary(req, res);
});

// Trigger immediate data collection (admin endpoint)
router.post('/collect/trigger', (req, res) => {
  historyController.triggerDataCollection(req, res);
});

// Get data collection status
router.get('/collect/status', (req, res) => {
  historyController.getCollectionStatus(req, res);
});

export { router as historyRoutes };