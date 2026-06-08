import { Router } from 'express';
import { authenticate }       from '../middleware/authenticate.js';
import { requireRole }        from '../middleware/requireRole.js';
import { checkSubscription, checkPredictionLimit } from '../middleware/checkSubscription.js';
import {
  getPatients, getPatientById, createPatient,
  getClinicalDataHistory,
  createClinicalData, updateClinicalData, deleteClinicalData,
  createLabOrder,
  createPrediction, getPredictions, getPredictionById,
  getAlerts, markAlertRead,
  getLabTestResults, acknowledgeResult,
} from '../controllers/doctorController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('DOCTOR'));

// Patients
router.get('/patients',                  getPatients);
router.get('/patients/:patientId',       getPatientById);
router.post('/patients',                 checkSubscription, createPatient);

// Clinical data
// NOTE: /clinical-data/patient/:patientId must come BEFORE /clinical-data/:dataId
// so the literal "patient" segment doesn't get matched as a dataId UUID.
router.get('/clinical-data/patient/:patientId', getClinicalDataHistory);
router.post('/clinical-data',                   checkSubscription, createClinicalData);
router.patch('/clinical-data/:dataId',          updateClinicalData);
router.delete('/clinical-data/:dataId',         deleteClinicalData);

// Lab orders
router.post('/lab-orders',               checkSubscription, createLabOrder);

// Predictions
router.get('/predictions',               getPredictions);
router.get('/predictions/:predictionId', getPredictionById);
router.post('/predictions',              checkPredictionLimit, createPrediction);

// Alerts
router.get('/alerts',                    getAlerts);
router.patch('/alerts/:alertId/read',    markAlertRead);

// Lab results (doctor read + acknowledge)
router.get('/lab-results/:testId',                  getLabTestResults);
router.patch('/lab-results/:resultId/acknowledge',  acknowledgeResult);

export default router;
