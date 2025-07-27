import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

// GET /auth/salesforce - Initiate OAuth flow
router.get('/salesforce', AuthController.initiateOAuth);

// GET /auth/salesforce/callback - Handle OAuth callback
router.get('/salesforce/callback', AuthController.handleCallback);

export { router as authRoutes };