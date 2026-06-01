import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getLabOrders, getLabOrderById, startOrder,
  enterResults, getLabStats,
} from '../controllers/labController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('LAB_TECH'));

router.get('/stats',                   getLabStats);
router.get('/orders',                  getLabOrders);
router.get('/orders/:testId',          getLabOrderById);
router.patch('/orders/:testId/start',  startOrder);
router.post('/results',                enterResults);

export default router;
