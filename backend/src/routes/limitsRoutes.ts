import { Router } from 'express';
import { LimitsController } from '../controllers/limitsController';

const router = Router();

// GET /api/limits - Get org limits for session
router.get('/limits', LimitsController.getOrgLimits);

// GET /api/session/validate - Validate session
router.get('/session/validate', LimitsController.validateSession);

export { router as limitsRoutes };