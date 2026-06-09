import { Router } from 'express';
import { register, login, refresh, logout, getMe, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refresh);
router.post('/logout',   logout);
router.get('/me',        authenticate, getMe);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;
