import { Router } from 'express';
import { registerOrganization } from '../controllers/organizationController.js';

const router = Router();

/**
 * POST /api/organizations
 * Public — no auth required.
 * Image 4 Phase 1: Creates org + trial subscription + manager account in one transaction.
 */
router.post('/', registerOrganization);

export default router;
