import { Router } from 'express';
import { getPlans, getPlanById } from '../controllers/planController.js';

const router = Router();

router.get('/',        getPlans);
router.get('/:planId', getPlanById);

export default router;
