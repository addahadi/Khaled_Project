import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { queryClient }   from '@/api/queryClientSetup';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ProtectedRoute    from '@/components/auth/ProtectedRoute';

// ─── Layouts ──────────────────────────────────────────────────────────────────
import { DoctorLayout }  from '@/components/doctor/DoctorLayout';
import { LabLayout }     from '@/components/lab/LabLayout';
import { ManagerLayout } from '@/components/manager/ManagerLayout';

// ─── Public pages ─────────────────────────────────────────────────────────────
import Landing from '@/pages/public/Landing';
import About   from '@/pages/public/About';

// ─── Auth pages ───────────────────────────────────────────────────────────────
import Login                from '@/pages/auth/Login';
import RegisterOrganization from '@/pages/auth/RegisterOrganization'; // only registration path
import ActivateAccount      from '@/pages/auth/ActivateAccount';      // invitation activation
import ForgotPassword       from '@/pages/auth/ForgotPassword';       // password reset stub
import ResetPassword        from '@/pages/auth/ResetPassword';
import VerifyEmail          from '@/pages/auth/VerifyEmail';

// ─── Doctor pages ─────────────────────────────────────────────────────────────
import DoctorDashboard   from '@/pages/doctor/Dashboard';
import Patients          from '@/pages/doctor/Patients';
import PatientDetail     from '@/pages/doctor/PatientDetail';
import NewPrediction     from '@/pages/doctor/NewPrediction';
import PredictionHistory from '@/pages/doctor/PredictionHistory';
import DoctorProfile     from '@/pages/doctor/Profile';
import Alerts            from '@/pages/doctor/Alerts';
import { AlertsProvider } from '@/contexts/AlertsContext';

// ─── Lab Tech pages ───────────────────────────────────────────────────────────
import LabDashboard from '@/pages/lab/LabDashboard';
import LabOrders    from '@/pages/lab/LabOrders';
import EnterResults from '@/pages/lab/EnterResults';
import LabAlerts    from '@/pages/lab/LabAlerts';
import LabProfile   from '@/pages/manager/Profile';

// ─── Manager pages ────────────────────────────────────────────────────────────
import ManagerDashboard from '@/pages/manager/ManagerDashboard';
import Staff            from '@/pages/manager/Staff';
import Departments      from '@/pages/manager/Departments';
import Subscription     from '@/pages/manager/Subscription';
import Reports          from '@/pages/manager/Reports';
import ManagerProfile   from '@/pages/manager/Profile';

// ─── Root redirect ────────────────────────────────────────────────────────────
function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Landing />;
  const map = {
    DOCTOR:   '/doctor/dashboard',
    LAB_TECH: '/lab/dashboard',
    MANAGER:  '/manager/dashboard',
  } as const;
  return <Navigate to={map[user.role]} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>

            {/* ── Public ────────────────────────────────────────────────── */}
            <Route path="/"      element={<RootRedirect />} />
            <Route path="/about" element={<About />} />

            {/* ── Auth ──────────────────────────────────────────────────── */}
            <Route path="/login"                  element={<Login />} />
            {/*
             * /register-organization  — the ONLY way to create an account.
             * 3-step wizard: personal info → org info → choose plan.
             * User becomes Hospital Manager automatically.
             *
             * /activate/:token  — invited staff set their password here.
             * No self-registration for doctors or lab techs.
             */}
            <Route path="/register-organization"  element={<RegisterOrganization />} />
            <Route path="/activate/:token"        element={<ActivateAccount />} />
            <Route path="/verify-email"           element={<VerifyEmail />} />
            <Route path="/forgot-password"        element={<ForgotPassword />} />
            <Route path="/reset-password"         element={<ResetPassword />} />

            {/* ── Doctor panel ──────────────────────────────────────────── */}
            <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
              <Route element={<AlertsProvider><DoctorLayout /></AlertsProvider>}>
                <Route path="/doctor"                        element={<Navigate to="/doctor/dashboard" replace />} />
                <Route path="/doctor/dashboard"              element={<DoctorDashboard />} />
                <Route path="/doctor/patients"               element={<Patients />} />
                <Route path="/doctor/patients/:patientId"    element={<PatientDetail />} />
                <Route path="/doctor/predictions"            element={<PredictionHistory />} />
                <Route path="/doctor/predictions/new"        element={<NewPrediction />} />
                <Route path="/doctor/profile"                element={<DoctorProfile />} />
                <Route path="/doctor/alerts"                 element={<Alerts />} />
              </Route>
            </Route>

            {/* ── Lab Tech panel ────────────────────────────────────────── */}
            <Route element={<ProtectedRoute allowedRoles={['LAB_TECH']} />}>
              <Route element={<LabLayout />}>
                <Route path="/lab"                    element={<Navigate to="/lab/dashboard" replace />} />
                <Route path="/lab/dashboard"          element={<LabDashboard />} />
                <Route path="/lab/orders"             element={<LabOrders />} />
                <Route path="/lab/orders/:testId"     element={<EnterResults />} />
                <Route path="/lab/results"            element={<EnterResults />} />
                <Route path="/lab/alerts"             element={<LabAlerts />} />
                <Route path="/lab/profile"            element={<LabProfile />} />
              </Route>
            </Route>

            {/* ── Manager panel ─────────────────────────────────────────── */}
            <Route element={<ProtectedRoute allowedRoles={['MANAGER']} />}>
              <Route element={<ManagerLayout />}>
                <Route path="/manager"                    element={<Navigate to="/manager/dashboard" replace />} />
                <Route path="/manager/dashboard"          element={<ManagerDashboard />} />
                <Route path="/manager/staff"              element={<Staff />} />
                <Route path="/manager/departments"        element={<Departments />} />
                <Route path="/manager/subscription"       element={<Subscription />} />
                <Route path="/manager/reports"            element={<Reports />} />
                <Route path="/manager/profile"            element={<ManagerProfile />} />
              </Route>
            </Route>

            {/* ── 404 ───────────────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
