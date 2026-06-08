import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole }  from '../middleware/requireRole.js';
import {
  getLabOrders,
  getLabOrderById,
  startOrder,
  releaseOrder,
  enterResults,
  amendResult,
  getLabAlerts,
  markLabAlertRead,
  getUnits,
  getLabStats,
} from '../controllers/labController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('LAB_TECH'));

// Stats & lookup
router.get('/stats',                           getLabStats);
router.get('/units',                           getUnits);

// Orders — paginated + filterable: /api/lab/orders?status=PENDING&search=john&page=1&limit=20
router.get('/orders',                          getLabOrders);
router.get('/orders/:testId',                  getLabOrderById);
router.patch('/orders/:testId/start',          startOrder);
router.patch('/orders/:testId/release',        releaseOrder);

// Results
router.post('/results',                        enterResults);
router.post('/results/:resultId/amend',        amendResult);

// Alerts
router.get('/alerts',                          getLabAlerts);
router.patch('/alerts/:alertId/read',          markLabAlertRead);

export default router;
