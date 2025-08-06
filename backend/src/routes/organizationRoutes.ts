import { Router } from 'express';
import { OrganizationController } from '../controllers/organizationController';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// Protected routes (require authentication)
router.post('/connect', authenticateToken, OrganizationController.connectOrganization);
router.get('/', authenticateToken, OrganizationController.getOrganizations);
router.get('/:orgId', authenticateToken, OrganizationController.getOrganization);
router.put('/:orgId', authenticateToken, OrganizationController.updateOrganization);
router.delete('/:orgId', authenticateToken, OrganizationController.deleteOrganization);
router.get('/:orgId/limits', authenticateToken, OrganizationController.getOrganizationLimits);
router.post('/:orgId/refresh', authenticateToken, OrganizationController.refreshOrganizationToken);

// Backwards compatibility route (supports both authenticated and session-based access)
router.get('/limits/legacy', optionalAuth, OrganizationController.getLimitsLegacy);

export { router as organizationRoutes };