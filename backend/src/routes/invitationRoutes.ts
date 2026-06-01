import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole }  from '../middleware/requireRole.js';
import { checkUserLimit } from '../middleware/checkSubscription.js';
import {
  inviteStaff,
  getInvitations,
  activateInvitation,
  cancelInvitation,
} from '../controllers/invitationController.js';

const router = Router();

/**
 * Public — no auth (staff clicking their invite email link).
 * Image 4 Phase 3: PATCH /users/{id}/activate {password}
 * We use token-in-URL approach: PATCH /api/invitations/activate/:token
 */
router.patch('/activate/:token', activateInvitation);

/**
 * Protected — MANAGER only.
 */
router.use(authenticate);
router.use(requireRole('MANAGER'));

/**
 * GET  /api/invitations   — list org invitations
 * POST /api/invitations   — invite staff member (with user-limit check)
 */
router.get('/',    getInvitations);
router.post('/',   checkUserLimit, inviteStaff);

/**
 * DELETE /api/invitations/:invitationId — cancel a pending invite
 */
router.delete('/:invitationId', cancelInvitation);

export default router;
