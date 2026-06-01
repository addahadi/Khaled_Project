import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getMySubscription,
  createSubscription,
  changePlan,
  getUsage,
} from '../controllers/subscriptionController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));

router.get('/my',          getMySubscription);
router.get('/usage',       getUsage);
router.post('/',           createSubscription);
router.patch('/change-plan', changePlan);

export default router;
