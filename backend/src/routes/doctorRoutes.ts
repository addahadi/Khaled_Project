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
  getLabTechs,
} from '../controllers/doctorController.js';

import {
  getAssignments,
  createAssignment,
  dischargeAssignment,
  transferPrimary,
  getOrgDoctors,
} from '../controllers/assignmentController.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('DOCTOR'));

// ── Patients ──────────────────────────────────────────────────────────────────
// GET  /doctor/patients?scope=mine|org&search=&limit=&cursor=
// POST /doctor/patients
// GET  /doctor/patients/:patientId
router.get('/patients',             getPatients);
router.post('/patients',            checkSubscription, createPatient);
router.get('/patients/:patientId',  getPatientById);

// ── Assignments (care team) ───────────────────────────────────────────────────
// NOTE: /join must be declared BEFORE /:assignmentId routes
// so the literal "join" segment is not matched as a UUID.

// GET    /doctor/patients/:patientId/assignments
// POST   /doctor/patients/:patientId/assignments          (assign a colleague)
// DELETE /doctor/patients/:patientId/assignments/:assignmentId
// PATCH  /doctor/patients/:patientId/assignments/:assignmentId/transfer
router.get('/patients/:patientId/assignments',                        getAssignments);
router.post('/patients/:patientId/assignments',                       createAssignment);
router.delete('/patients/:patientId/assignments/:assignmentId',       dischargeAssignment);
router.patch('/patients/:patientId/assignments/:assignmentId/transfer', transferPrimary);

// ── Clinical data ─────────────────────────────────────────────────────────────
// NOTE: /clinical-data/patient/:patientId must come BEFORE /clinical-data/:dataId
// so the literal "patient" segment is not matched as a dataId UUID.
router.get('/clinical-data/patient/:patientId', getClinicalDataHistory);
router.post('/clinical-data',                   checkSubscription, createClinicalData);
router.patch('/clinical-data/:dataId',          updateClinicalData);
router.delete('/clinical-data/:dataId',         deleteClinicalData);

// ── Lab orders ────────────────────────────────────────────────────────────────
router.get('/lab-techs',    getLabTechs);
router.get('/org-doctors',  getOrgDoctors);
router.post('/lab-orders',  checkSubscription, createLabOrder);

// ── Predictions ───────────────────────────────────────────────────────────────
// GET /doctor/predictions?scope=mine|org
router.get('/predictions',               getPredictions);
router.get('/predictions/:predictionId', getPredictionById);
router.post('/predictions',              checkPredictionLimit, createPrediction);

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get('/alerts',                 getAlerts);
router.patch('/alerts/:alertId/read', markAlertRead);

// ── Lab results (doctor read + acknowledge) ───────────────────────────────────
router.get('/lab-results/:testId',                 getLabTestResults);
router.patch('/lab-results/:resultId/acknowledge', acknowledgeResult);

export default router;
