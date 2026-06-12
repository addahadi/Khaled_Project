import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getMySubscription,
  createSubscription,
  changePlan,
  getUsage,
  getOverageEvents,
  cancelSubscription,
  verifyChangePlan,
} from '../controllers/subscriptionController.js';

const router = Router();

router.post('/verify-change', verifyChangePlan);

router.use(authenticate);
router.use(requireRole('MANAGER'));

router.get('/my',          getMySubscription);
router.delete('/my',       cancelSubscription);
router.get('/usage',       getUsage);
router.get('/overage',     getOverageEvents);
router.post('/',           createSubscription);
router.patch('/change-plan', changePlan);

export default router;
