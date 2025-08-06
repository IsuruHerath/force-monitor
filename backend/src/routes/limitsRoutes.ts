import { Router } from 'express';
import { LimitsController } from '../controllers/limitsController';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// GET /api/limits - Get org limits (supports both session and authenticated access)
router.get('/limits', optionalAuth, LimitsController.getOrgLimits);

// GET /api/session/validate - Validate session
router.get('/session/validate', LimitsController.validateSession);

export { router as limitsRoutes };