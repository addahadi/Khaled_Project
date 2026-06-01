import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import globalErrorHandler  from './middleware/errorHandler.js';
import authRoutes          from './routes/authRoutes.js';
import planRoutes          from './routes/planRoutes.js';
import subscriptionRoutes  from './routes/subscriptionRoutes.js';
import organizationRoutes  from './routes/organizationRoutes.js';
import invitationRoutes    from './routes/invitationRoutes.js';
import doctorRoutes        from './routes/doctorRoutes.js';
import labRoutes           from './routes/labRoutes.js';
import managerRoutes       from './routes/managerRoutes.js';

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/plans',         planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/organizations', organizationRoutes); // Image 4 Phase 1 (public)
app.use('/api/invitations',   invitationRoutes);   // Image 3 + 4 Phase 3
app.use('/api/doctor',        doctorRoutes);        // Image 1 + 2
app.use('/api/lab',           labRoutes);
app.use('/api/manager',       managerRoutes);       // Image 4 Phase 2

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 'fail', messageKey: 'ERROR_ROUTE_NOT_FOUND' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
