import { Router } from 'express';
import { 
  register, login, refresh, logout, getMe, forgotPassword, 
  resetPassword, updateProfile, verifyEmail, getSessions, 
  revokeSession, revokeOtherSessions 
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refresh);
router.post('/logout',   logout);
router.get('/me',        authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

router.post('/verify-email', verifyEmail);

router.get('/sessions',         authenticate, getSessions);
router.delete('/sessions',      authenticate, revokeOtherSessions);
router.delete('/sessions/:id',  authenticate, revokeSession);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;
