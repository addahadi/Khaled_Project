import { Router } from 'express';
import { authenticate }       from '../middleware/authenticate.js';
import { requireRole }        from '../middleware/requireRole.js';
import { checkSubscription, checkPredictionLimit } from '../middleware/checkSubscription.js';
import {
  getPatients, getPatientById, createPatient,
  createClinicalData,
  createLabOrder,
  createPrediction, getPredictions, getPredictionById,
  getAlerts, markAlertRead,
} from '../controllers/doctorController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('DOCTOR'));

// Patients
router.get('/patients',                  getPatients);
router.get('/patients/:patientId',       getPatientById);
router.post('/patients',                 checkSubscription, createPatient);

// Clinical data
router.post('/clinical-data',            checkSubscription, createClinicalData);

// Lab orders
router.post('/lab-orders',               checkSubscription, createLabOrder);

/**
 * Predictions — Image 1 checkPredictionLimit middleware:
 *   - Trial + limit reached  → 402
 *   - Paid  + limit reached  → overage path → proceed with isOverage=true
 *   - Within limit           → proceed with isOverage=false
 *
 * Image 2 pipeline happens inside createPrediction controller.
 */
router.get('/predictions',               getPredictions);
router.get('/predictions/:predictionId', getPredictionById);
router.post('/predictions',              checkPredictionLimit, createPrediction);

// Alerts
router.get('/alerts',                    getAlerts);
router.patch('/alerts/:alertId/read',    markAlertRead);

export default router;
