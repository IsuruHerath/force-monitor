import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

// GET /auth/salesforce - Initiate OAuth flow (Phase 1 backwards compatibility)
router.get('/salesforce', AuthController.initiateOAuth);

// GET /auth/salesforce/callback - Handle OAuth callback (Phase 1 backwards compatibility)
router.get('/salesforce/callback', AuthController.handleCallback);

// GET /auth/connect-org - Initiate OAuth flow for organization connection (Phase 2)
router.get('/connect-org', AuthController.initiateOrgConnection);

export { router as authRoutes };