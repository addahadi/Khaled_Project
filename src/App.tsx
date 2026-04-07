import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import { DoctorLayout } from "./components/doctor/DoctorLayout";
import Dashboard from "./pages/doctor/Dashboard";
import PatientsList from "./pages/doctor/PatientsList";
import NewPatient from "./pages/doctor/NewPatient";
import PatientDetail from "./pages/doctor/PatientDetail";
import NewClinicalData from "./pages/doctor/NewClinicalData";
import NewLabOrder from "./pages/doctor/NewLabOrder";
import PredictionsList from "./pages/doctor/PredictionsList";
import NewPrediction from "./pages/doctor/NewPrediction";
import PredictionResult from "./pages/doctor/PredictionResult";
import Alerts from "./pages/doctor/Alerts";
import Profile from "./pages/doctor/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/doctor/dashboard" replace />} />
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={<PatientsList />} />
            <Route path="patients/new" element={<NewPatient />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="patients/:id/clinical-data/new" element={<NewClinicalData />} />
            <Route path="patients/:id/lab-orders/new" element={<NewLabOrder />} />
            <Route path="predictions" element={<PredictionsList />} />
            <Route path="predictions/new" element={<NewPrediction />} />
            <Route path="predictions/:id" element={<PredictionResult />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
