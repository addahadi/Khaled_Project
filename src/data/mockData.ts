export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female";
  medicalHistory: string;
  lastVisit: string;
  riskStatus: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "NONE";
}

export interface ClinicalData {
  id: string;
  patientId: string;
  date: string;
  temperature: number;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  spO2: number;
  symptoms: string[];
}

export interface LabOrder {
  id: string;
  patientId: string;
  testType: string;
  status: "PENDING" | "COMPLETED";
  orderedDate: string;
  completedDate?: string;
  notes: string;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  patientId: string;
  testType: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "NORMAL" | "ABNORMAL" | "CRITICAL";
  date: string;
}

export interface Prediction {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  riskScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  confidence: number;
  status: "COMPLETED" | "PROCESSING";
  modelVersion: string;
  featureContributions: { feature: string; contribution: number }[];
}

export interface Alert {
  id: string;
  type: "RESULT_READY" | "ABNORMAL_RESULT" | "CRITICAL_RESULT";
  title: string;
  message: string;
  date: string;
  read: boolean;
  linkTo: string;
}

export const doctor = {
  name: "Dr. Amira Benali",
  email: "a.benali@diaginfect.dz",
  specialty: "Infectious Diseases",
  avatar: "",
};

export const patients: Patient[] = [
  { id: "p1", name: "Karim Medjdoub", age: 45, gender: "Male", medicalHistory: "Type 2 Diabetes, Hypertension", lastVisit: "2026-04-05", riskStatus: "HIGH" },
  { id: "p2", name: "Fatima Zohra Hadj", age: 32, gender: "Female", medicalHistory: "Asthma", lastVisit: "2026-04-04", riskStatus: "LOW" },
  { id: "p3", name: "Youcef Belkacem", age: 67, gender: "Male", medicalHistory: "COPD, Heart failure", lastVisit: "2026-04-03", riskStatus: "CRITICAL" },
  { id: "p4", name: "Nadia Ait Ahmed", age: 28, gender: "Female", medicalHistory: "None", lastVisit: "2026-04-02", riskStatus: "NONE" },
  { id: "p5", name: "Mohamed Salah Bouzid", age: 54, gender: "Male", medicalHistory: "Chronic kidney disease", lastVisit: "2026-04-01", riskStatus: "MODERATE" },
  { id: "p6", name: "Amina Khelif", age: 41, gender: "Female", medicalHistory: "Rheumatoid arthritis, Immunosuppressed", lastVisit: "2026-03-30", riskStatus: "HIGH" },
  { id: "p7", name: "Rachid Benmoussa", age: 73, gender: "Male", medicalHistory: "Prostate cancer, Post-surgery", lastVisit: "2026-03-28", riskStatus: "CRITICAL" },
  { id: "p8", name: "Leila Djebbar", age: 36, gender: "Female", medicalHistory: "HIV positive, on ART", lastVisit: "2026-03-27", riskStatus: "MODERATE" },
  { id: "p9", name: "Omar Tlemcani", age: 59, gender: "Male", medicalHistory: "Liver cirrhosis", lastVisit: "2026-03-25", riskStatus: "HIGH" },
  { id: "p10", name: "Sara Bensalem", age: 22, gender: "Female", medicalHistory: "None", lastVisit: "2026-03-24", riskStatus: "LOW" },
];

export const clinicalDataRecords: ClinicalData[] = [
  { id: "cd1", patientId: "p1", date: "2026-04-05", temperature: 38.5, heartRate: 98, bloodPressureSystolic: 145, bloodPressureDiastolic: 92, spO2: 94, symptoms: ["Fever", "Fatigue", "Cough"] },
  { id: "cd2", patientId: "p2", date: "2026-04-04", temperature: 36.8, heartRate: 72, bloodPressureSystolic: 118, bloodPressureDiastolic: 76, spO2: 98, symptoms: ["Mild cough"] },
  { id: "cd3", patientId: "p3", date: "2026-04-03", temperature: 39.2, heartRate: 110, bloodPressureSystolic: 160, bloodPressureDiastolic: 100, spO2: 88, symptoms: ["High fever", "Dyspnea", "Confusion", "Chills"] },
  { id: "cd4", patientId: "p5", date: "2026-04-01", temperature: 37.8, heartRate: 88, bloodPressureSystolic: 138, bloodPressureDiastolic: 88, spO2: 95, symptoms: ["Low-grade fever", "Malaise"] },
  { id: "cd5", patientId: "p6", date: "2026-03-30", temperature: 38.9, heartRate: 102, bloodPressureSystolic: 130, bloodPressureDiastolic: 85, spO2: 93, symptoms: ["Fever", "Joint pain", "Fatigue"] },
  { id: "cd6", patientId: "p7", date: "2026-03-28", temperature: 39.5, heartRate: 115, bloodPressureSystolic: 155, bloodPressureDiastolic: 95, spO2: 86, symptoms: ["High fever", "Wound discharge", "Tachycardia"] },
  { id: "cd7", patientId: "p9", date: "2026-03-25", temperature: 38.3, heartRate: 95, bloodPressureSystolic: 125, bloodPressureDiastolic: 80, spO2: 92, symptoms: ["Fever", "Abdominal pain", "Jaundice"] },
];

export const labOrders: LabOrder[] = [
  { id: "lo1", patientId: "p1", testType: "Complete Blood Count (CBC)", status: "COMPLETED", orderedDate: "2026-04-04", completedDate: "2026-04-05", notes: "Routine check" },
  { id: "lo2", patientId: "p1", testType: "C-Reactive Protein (CRP)", status: "COMPLETED", orderedDate: "2026-04-04", completedDate: "2026-04-05", notes: "Infection marker" },
  { id: "lo3", patientId: "p3", testType: "Blood Culture", status: "PENDING", orderedDate: "2026-04-03", notes: "Suspected sepsis" },
  { id: "lo4", patientId: "p3", testType: "Procalcitonin", status: "COMPLETED", orderedDate: "2026-04-02", completedDate: "2026-04-03", notes: "Sepsis marker" },
  { id: "lo5", patientId: "p5", testType: "Urinalysis", status: "COMPLETED", orderedDate: "2026-03-31", completedDate: "2026-04-01", notes: "UTI screening" },
  { id: "lo6", patientId: "p6", testType: "Complete Blood Count (CBC)", status: "PENDING", orderedDate: "2026-03-30", notes: "Monitor WBC" },
  { id: "lo7", patientId: "p7", testType: "Wound Culture", status: "COMPLETED", orderedDate: "2026-03-27", completedDate: "2026-03-28", notes: "Post-surgical wound" },
  { id: "lo8", patientId: "p9", testType: "Liver Function Tests", status: "PENDING", orderedDate: "2026-03-25", notes: "Baseline" },
];

export const labResults: LabResult[] = [
  { id: "lr1", labOrderId: "lo1", patientId: "p1", testType: "WBC Count", value: "14.2", unit: "×10³/µL", referenceRange: "4.5-11.0", flag: "ABNORMAL", date: "2026-04-05" },
  { id: "lr2", labOrderId: "lo1", patientId: "p1", testType: "Hemoglobin", value: "13.5", unit: "g/dL", referenceRange: "13.0-17.0", flag: "NORMAL", date: "2026-04-05" },
  { id: "lr3", labOrderId: "lo2", patientId: "p1", testType: "CRP", value: "48", unit: "mg/L", referenceRange: "0-10", flag: "ABNORMAL", date: "2026-04-05" },
  { id: "lr4", labOrderId: "lo4", patientId: "p3", testType: "Procalcitonin", value: "8.5", unit: "ng/mL", referenceRange: "0-0.5", flag: "CRITICAL", date: "2026-04-03" },
  { id: "lr5", labOrderId: "lo5", patientId: "p5", testType: "WBC in Urine", value: "25", unit: "/HPF", referenceRange: "0-5", flag: "ABNORMAL", date: "2026-04-01" },
  { id: "lr6", labOrderId: "lo7", patientId: "p7", testType: "Wound Culture", value: "Staphylococcus aureus (MRSA)", unit: "", referenceRange: "No growth", flag: "CRITICAL", date: "2026-03-28" },
];

export const predictions: Prediction[] = [
  {
    id: "pred1", patientId: "p1", patientName: "Karim Medjdoub", date: "2026-04-05", riskScore: 72, riskLevel: "HIGH", confidence: 89, status: "COMPLETED", modelVersion: "v2.3.1",
    featureContributions: [
      { feature: "WBC Count", contribution: 0.25 },
      { feature: "CRP Level", contribution: 0.22 },
      { feature: "Temperature", contribution: 0.18 },
      { feature: "SpO2", contribution: -0.12 },
      { feature: "Age", contribution: 0.10 },
      { feature: "Heart Rate", contribution: 0.08 },
      { feature: "Diabetes History", contribution: 0.15 },
    ],
  },
  {
    id: "pred2", patientId: "p3", patientName: "Youcef Belkacem", date: "2026-04-03", riskScore: 91, riskLevel: "CRITICAL", confidence: 94, status: "COMPLETED", modelVersion: "v2.3.1",
    featureContributions: [
      { feature: "Procalcitonin", contribution: 0.30 },
      { feature: "Temperature", contribution: 0.22 },
      { feature: "SpO2", contribution: -0.20 },
      { feature: "Heart Rate", contribution: 0.15 },
      { feature: "Age", contribution: 0.12 },
      { feature: "COPD History", contribution: 0.10 },
    ],
  },
  {
    id: "pred3", patientId: "p2", patientName: "Fatima Zohra Hadj", date: "2026-04-04", riskScore: 18, riskLevel: "LOW", confidence: 92, status: "COMPLETED", modelVersion: "v2.3.1",
    featureContributions: [
      { feature: "Temperature", contribution: -0.05 },
      { feature: "WBC Count", contribution: -0.08 },
      { feature: "SpO2", contribution: -0.15 },
      { feature: "Age", contribution: -0.10 },
      { feature: "Heart Rate", contribution: -0.05 },
    ],
  },
  {
    id: "pred4", patientId: "p5", patientName: "Mohamed Salah Bouzid", date: "2026-04-01", riskScore: 48, riskLevel: "MODERATE", confidence: 85, status: "COMPLETED", modelVersion: "v2.3.1",
    featureContributions: [
      { feature: "WBC in Urine", contribution: 0.20 },
      { feature: "Temperature", contribution: 0.12 },
      { feature: "CKD History", contribution: 0.15 },
      { feature: "SpO2", contribution: -0.08 },
      { feature: "Age", contribution: 0.08 },
    ],
  },
  {
    id: "pred5", patientId: "p7", patientName: "Rachid Benmoussa", date: "2026-03-28", riskScore: 88, riskLevel: "CRITICAL", confidence: 91, status: "COMPLETED", modelVersion: "v2.3.1",
    featureContributions: [
      { feature: "Wound Culture (MRSA)", contribution: 0.32 },
      { feature: "Temperature", contribution: 0.20 },
      { feature: "Heart Rate", contribution: 0.12 },
      { feature: "SpO2", contribution: -0.18 },
      { feature: "Post-surgery", contribution: 0.14 },
    ],
  },
  {
    id: "pred6", patientId: "p6", patientName: "Amina Khelif", date: "2026-03-30", riskScore: 65, riskLevel: "HIGH", confidence: 87, status: "COMPLETED", modelVersion: "v2.3.1",
    featureContributions: [
      { feature: "Immunosuppressed", contribution: 0.25 },
      { feature: "Temperature", contribution: 0.18 },
      { feature: "WBC Count", contribution: 0.12 },
      { feature: "SpO2", contribution: -0.10 },
      { feature: "Joint Pain", contribution: 0.08 },
    ],
  },
];

export const alerts: Alert[] = [
  { id: "a1", type: "CRITICAL_RESULT", title: "Critical: Procalcitonin Level", message: "Patient Youcef Belkacem has critical procalcitonin levels (8.5 ng/mL). Immediate review required.", date: "2026-04-03T14:30:00", read: false, linkTo: "/doctor/predictions/pred2" },
  { id: "a2", type: "RESULT_READY", title: "Prediction Complete", message: "Infection risk prediction for Karim Medjdoub is ready. Risk level: HIGH (72/100).", date: "2026-04-05T10:15:00", read: false, linkTo: "/doctor/predictions/pred1" },
  { id: "a3", type: "ABNORMAL_RESULT", title: "Abnormal WBC Count", message: "Patient Karim Medjdoub has elevated WBC count (14.2 ×10³/µL). Review recommended.", date: "2026-04-05T09:00:00", read: false, linkTo: "/doctor/patients/p1" },
  { id: "a4", type: "CRITICAL_RESULT", title: "Critical: MRSA Detected", message: "Wound culture for Rachid Benmoussa positive for MRSA. Urgent action needed.", date: "2026-03-28T16:45:00", read: true, linkTo: "/doctor/predictions/pred5" },
  { id: "a5", type: "RESULT_READY", title: "Prediction Complete", message: "Infection risk prediction for Fatima Zohra Hadj is ready. Risk level: LOW (18/100).", date: "2026-04-04T11:30:00", read: true, linkTo: "/doctor/predictions/pred3" },
  { id: "a6", type: "ABNORMAL_RESULT", title: "Abnormal Urinalysis", message: "Patient Mohamed Salah Bouzid has elevated WBC in urine (25/HPF). Possible UTI.", date: "2026-04-01T13:20:00", read: true, linkTo: "/doctor/patients/p5" },
  { id: "a7", type: "RESULT_READY", title: "Prediction Complete", message: "Infection risk prediction for Mohamed Salah Bouzid is ready. Risk level: MODERATE.", date: "2026-04-01T14:00:00", read: true, linkTo: "/doctor/predictions/pred4" },
  { id: "a8", type: "CRITICAL_RESULT", title: "Critical Risk: Youcef Belkacem", message: "Prediction shows CRITICAL infection risk (91/100). Immediate clinical review.", date: "2026-04-03T15:00:00", read: false, linkTo: "/doctor/predictions/pred2" },
  { id: "a9", type: "RESULT_READY", title: "Lab Results Ready", message: "CBC results for Karim Medjdoub are now available.", date: "2026-04-05T08:30:00", read: true, linkTo: "/doctor/patients/p1" },
  { id: "a10", type: "ABNORMAL_RESULT", title: "Elevated CRP", message: "CRP for Karim Medjdoub is 48 mg/L (normal: 0-10). Infection likely.", date: "2026-04-05T09:15:00", read: false, linkTo: "/doctor/patients/p1" },
  { id: "a11", type: "RESULT_READY", title: "Prediction Complete", message: "Infection risk prediction for Amina Khelif is ready. Risk level: HIGH.", date: "2026-03-30T12:00:00", read: true, linkTo: "/doctor/predictions/pred6" },
];

export const getRiskColor = (level: string) => {
  switch (level) {
    case "LOW": return "text-risk-low";
    case "MODERATE": return "text-risk-moderate";
    case "HIGH": return "text-risk-high";
    case "CRITICAL": return "text-risk-critical";
    default: return "text-muted-foreground";
  }
};

export const getRiskBgColor = (level: string) => {
  switch (level) {
    case "LOW": return "bg-risk-low/10 text-risk-low border-risk-low/20";
    case "MODERATE": return "bg-risk-moderate/10 text-risk-moderate border-risk-moderate/20";
    case "HIGH": return "bg-risk-high/10 text-risk-high border-risk-high/20";
    case "CRITICAL": return "bg-risk-critical/10 text-risk-critical border-risk-critical/20";
    default: return "bg-muted text-muted-foreground";
  }
};
