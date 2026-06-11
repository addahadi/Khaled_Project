/**
 * AIService — Clinical Scoring Engine
 *
 * Evidence-based rule engine that computes infection risk from vitals, lab
 * results, and symptoms.  Designed as a medically meaningful interim until
 * the real ML model is deployed.
 *
 * When AI_SERVICE_URL is set, `runPrediction` will call the external
 * microservice instead.
 *
 * Composite score formula:
 *   risk = vitals × 0.30 + lab × 0.40 + symptoms × 0.20 + interaction × 0.10
 */

// ─── Public interfaces ───────────────────────────────────────────────────────

export interface ClinicalData {
  vitals:   Record<string, number | undefined>;
  symptoms: string[];
}

export interface LabResult {
  analyte_name:    string;
  value:           string;
  flag:            'NORMAL' | 'ABNORMAL' | 'CRITICAL';
  reference_low?:  number;
  reference_high?: number;
}

export interface FeatureExplanation {
  feature_name: string;
  contribution: number;   // SHAP-style value (0–1)
  direction:    'POSITIVE' | 'NEGATIVE';
  rank:         number;
}

export interface AIPayload {
  clinical:      ClinicalData | null;
  lab:           LabResult[];
  model_version: string;
}

export interface AIResult {
  risk_score:           number;          // 0–1
  risk_level:           'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  confidence:           number;          // 0–1
  raw_payload:          Record<string, unknown>;
  feature_explanations: FeatureExplanation[];
}

// ─── Risk-level helper ────────────────────────────────────────────────────────
function scoreToLevel(score: number): AIResult['risk_level'] {
  if (score >= 0.85) return 'CRITICAL';
  if (score >= 0.60) return 'HIGH';
  if (score >= 0.35) return 'MODERATE';
  return 'LOW';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. VITAL SIGNS SCORING
// ═══════════════════════════════════════════════════════════════════════════════

interface VitalScore {
  name:         string;
  score:        number;  // 0–1 (0 = normal, 1 = severely abnormal)
  description:  string;
}

function scoreTemperature(temp: number): VitalScore {
  let score = 0;
  let desc  = 'normal';

  if (temp < 35.0)       { score = 0.95; desc = 'severe hypothermia'; }
  else if (temp < 36.0)  { score = 0.55; desc = 'hypothermia'; }
  else if (temp <= 37.2) { score = 0.00; desc = 'normal'; }
  else if (temp <= 38.0) { score = 0.25; desc = 'low-grade fever'; }
  else if (temp <= 38.5) { score = 0.45; desc = 'mild fever'; }
  else if (temp <= 39.0) { score = 0.65; desc = 'moderate fever'; }
  else if (temp <= 39.5) { score = 0.80; desc = 'high fever'; }
  else                   { score = 0.95; desc = 'very high fever'; }

  return { name: 'Temperature', score, description: `${temp}°C — ${desc}` };
}

function scoreHeartRate(hr: number): VitalScore {
  let score = 0;
  let desc  = 'normal';

  if (hr < 40)           { score = 0.90; desc = 'severe bradycardia'; }
  else if (hr < 50)      { score = 0.60; desc = 'bradycardia'; }
  else if (hr < 60)      { score = 0.20; desc = 'low-normal'; }
  else if (hr <= 100)    { score = 0.00; desc = 'normal'; }
  else if (hr <= 110)    { score = 0.25; desc = 'mild tachycardia'; }
  else if (hr <= 120)    { score = 0.45; desc = 'moderate tachycardia'; }
  else if (hr <= 130)    { score = 0.65; desc = 'tachycardia'; }
  else if (hr <= 150)    { score = 0.80; desc = 'significant tachycardia'; }
  else                   { score = 0.95; desc = 'severe tachycardia'; }

  return { name: 'Heart Rate', score, description: `${hr} bpm — ${desc}` };
}

function scoreSpO2(spo2: number): VitalScore {
  let score = 0;
  let desc  = 'normal';

  if (spo2 >= 96)        { score = 0.00; desc = 'normal'; }
  else if (spo2 >= 93)   { score = 0.35; desc = 'mildly low'; }
  else if (spo2 >= 90)   { score = 0.65; desc = 'hypoxemia'; }
  else if (spo2 >= 85)   { score = 0.85; desc = 'significant hypoxemia'; }
  else                   { score = 0.95; desc = 'severe hypoxemia'; }

  return { name: 'SpO₂', score, description: `${spo2}% — ${desc}` };
}

function scoreSystolicBP(sbp: number): VitalScore {
  let score = 0;
  let desc  = 'normal';

  if (sbp < 70)          { score = 0.95; desc = 'severe hypotension (shock)'; }
  else if (sbp < 85)     { score = 0.70; desc = 'hypotension'; }
  else if (sbp < 90)     { score = 0.40; desc = 'borderline low'; }
  else if (sbp <= 140)   { score = 0.00; desc = 'normal'; }
  else if (sbp <= 160)   { score = 0.20; desc = 'mildly elevated'; }
  else                   { score = 0.35; desc = 'hypertension'; }

  return { name: 'Systolic BP', score, description: `${sbp} mmHg — ${desc}` };
}

function scoreDiastolicBP(dbp: number): VitalScore {
  let score = 0;
  let desc  = 'normal';

  if (dbp < 40)          { score = 0.80; desc = 'severe hypotension'; }
  else if (dbp < 55)     { score = 0.50; desc = 'low diastolic'; }
  else if (dbp < 60)     { score = 0.20; desc = 'borderline low'; }
  else if (dbp <= 90)    { score = 0.00; desc = 'normal'; }
  else if (dbp <= 100)   { score = 0.15; desc = 'mildly elevated'; }
  else                   { score = 0.30; desc = 'elevated'; }

  return { name: 'Diastolic BP', score, description: `${dbp} mmHg — ${desc}` };
}

/** Score all available vitals.  Returns weighted average (0–1) and per-vital explanations. */
function scoreVitals(vitals: Record<string, number | undefined>): {
  score:    number;
  features: FeatureExplanation[];
} {
  const scorers: { key: string; fn: (v: number) => VitalScore; weight: number }[] = [
    { key: 'temperature',              fn: scoreTemperature, weight: 0.30 },
    { key: 'heart_rate',               fn: scoreHeartRate,   weight: 0.25 },
    { key: 'spo2',                     fn: scoreSpO2,        weight: 0.25 },
    { key: 'blood_pressure_systolic',  fn: scoreSystolicBP,  weight: 0.12 },
    { key: 'blood_pressure_diastolic', fn: scoreDiastolicBP, weight: 0.08 },
  ];

  const results: { vs: VitalScore; weight: number }[] = [];
  let totalWeight = 0;

  for (const { key, fn, weight } of scorers) {
    const val = vitals[key];
    if (val === undefined || val === null) continue;
    results.push({ vs: fn(val), weight });
    totalWeight += weight;
  }

  if (results.length === 0) {
    return { score: 0, features: [] };
  }

  // Normalize weights to sum to 1.0 across available vitals
  const score = results.reduce((sum, r) => sum + r.vs.score * (r.weight / totalWeight), 0);

  const features: FeatureExplanation[] = results.map((r) => ({
    feature_name: r.vs.name,
    contribution: Math.round(r.vs.score * (r.weight / totalWeight) * 1000) / 1000,
    direction:    r.vs.score > 0.05 ? 'POSITIVE' : 'NEGATIVE',
    rank:         0, // will be assigned later
    _description: r.vs.description, // temporary — used for raw_payload
  } as FeatureExplanation & { _description?: string }));

  return { score: Math.round(score * 1000) / 1000, features };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LAB RESULTS SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/** Analyte-specific scoring functions.  Keys are lowercase analyte names. */
const ANALYTE_SCORERS: Record<string, (val: number) => { score: number; desc: string }> = {
  'wbc': (v) => {
    if (v >= 4.0 && v <= 11.0) return { score: 0.00, desc: 'normal range' };
    if (v > 11.0 && v <= 15.0) return { score: 0.35, desc: 'mild leukocytosis' };
    if (v > 15.0 && v <= 20.0) return { score: 0.60, desc: 'moderate leukocytosis' };
    if (v > 20.0)              return { score: 0.90, desc: 'severe leukocytosis' };
    if (v < 4.0 && v >= 2.0)   return { score: 0.50, desc: 'leukopenia' };
    return                              { score: 0.85, desc: 'severe leukopenia' };
  },
  'wbc count': (v) => ANALYTE_SCORERS['wbc'](v),
  'white blood cell count': (v) => ANALYTE_SCORERS['wbc'](v),

  'crp': (v) => {
    if (v < 5)    return { score: 0.00, desc: 'normal' };
    if (v < 10)   return { score: 0.15, desc: 'borderline elevated' };
    if (v < 50)   return { score: 0.40, desc: 'mildly elevated — possible infection' };
    if (v < 100)  return { score: 0.65, desc: 'moderately elevated — likely infection' };
    if (v < 200)  return { score: 0.85, desc: 'highly elevated — significant infection' };
    return                { score: 0.95, desc: 'severely elevated — severe infection/sepsis' };
  },
  'c-reactive protein': (v) => ANALYTE_SCORERS['crp'](v),
  'c reactive protein': (v) => ANALYTE_SCORERS['crp'](v),

  'procalcitonin': (v) => {
    if (v < 0.1)  return { score: 0.00, desc: 'normal — bacterial infection unlikely' };
    if (v < 0.25) return { score: 0.20, desc: 'low — local bacterial infection possible' };
    if (v < 0.5)  return { score: 0.40, desc: 'moderate — systemic infection possible' };
    if (v < 2.0)  return { score: 0.70, desc: 'high — systemic infection likely' };
    if (v < 10.0) return { score: 0.90, desc: 'very high — severe sepsis likely' };
    return                { score: 0.98, desc: 'extreme — septic shock' };
  },
  'pct': (v) => ANALYTE_SCORERS['procalcitonin'](v),

  'neutrophil': (v) => {
    // v is percentage
    if (v >= 40 && v <= 70) return { score: 0.00, desc: 'normal' };
    if (v > 70 && v <= 80)  return { score: 0.30, desc: 'mild neutrophilia (left shift)' };
    if (v > 80)             return { score: 0.65, desc: 'significant neutrophilia — bacterial infection likely' };
    if (v < 40 && v >= 20)  return { score: 0.35, desc: 'neutropenia' };
    return                          { score: 0.70, desc: 'severe neutropenia — infection risk' };
  },
  'neutrophil %': (v) => ANALYTE_SCORERS['neutrophil'](v),
  'neutrophils': (v) => ANALYTE_SCORERS['neutrophil'](v),

  'esr': (v) => {
    if (v < 20)   return { score: 0.00, desc: 'normal' };
    if (v < 40)   return { score: 0.20, desc: 'mildly elevated' };
    if (v < 70)   return { score: 0.40, desc: 'moderately elevated' };
    if (v < 100)  return { score: 0.60, desc: 'elevated — active inflammation' };
    return                { score: 0.75, desc: 'significantly elevated' };
  },
  'erythrocyte sedimentation rate': (v) => ANALYTE_SCORERS['esr'](v),

  'hemoglobin': (v) => {
    if (v >= 12 && v <= 17) return { score: 0.00, desc: 'normal' };
    if (v < 12 && v >= 10)  return { score: 0.15, desc: 'mild anemia' };
    if (v < 10 && v >= 7)   return { score: 0.35, desc: 'moderate anemia' };
    if (v < 7)              return { score: 0.55, desc: 'severe anemia' };
    return                          { score: 0.10, desc: 'polycythemia' };
  },

  'platelet count': (v) => {
    // v in thousands (×10³/µL)
    if (v >= 150 && v <= 400) return { score: 0.00, desc: 'normal' };
    if (v < 150 && v >= 100)  return { score: 0.20, desc: 'mild thrombocytopenia' };
    if (v < 100 && v >= 50)   return { score: 0.45, desc: 'moderate thrombocytopenia' };
    if (v < 50)               return { score: 0.70, desc: 'severe thrombocytopenia — DIC risk' };
    return                            { score: 0.10, desc: 'thrombocytosis' };
  },
  'platelets': (v) => ANALYTE_SCORERS['platelet count'](v),

  'lactate': (v) => {
    if (v < 2.0) return  { score: 0.00, desc: 'normal' };
    if (v < 4.0) return  { score: 0.50, desc: 'elevated — tissue hypoperfusion' };
    return               { score: 0.90, desc: 'severely elevated — shock/sepsis' };
  },

  'glucose': (v) => {
    if (v >= 70 && v <= 140) return { score: 0.00, desc: 'normal' };
    if (v > 140 && v <= 200) return { score: 0.15, desc: 'mildly elevated' };
    if (v > 200)             return { score: 0.30, desc: 'hyperglycemia — stress response' };
    if (v < 70 && v >= 50)   return { score: 0.25, desc: 'mild hypoglycemia' };
    return                          { score: 0.50, desc: 'severe hypoglycemia' };
  },
  'blood glucose': (v) => ANALYTE_SCORERS['glucose'](v),
};

/** Find a specific scorer by trying lowercase variations of the analyte name. */
function findAnalyteScorer(analyteName: string): ((val: number) => { score: number; desc: string }) | null {
  const lower = analyteName.toLowerCase().trim();
  if (ANALYTE_SCORERS[lower]) return ANALYTE_SCORERS[lower];

  // Try partial matches for common analyte names
  for (const key of Object.keys(ANALYTE_SCORERS)) {
    if (lower.includes(key) || key.includes(lower)) return ANALYTE_SCORERS[key];
  }
  return null;
}

function scoreLabResults(labs: LabResult[]): {
  score:    number;
  features: FeatureExplanation[];
} {
  if (labs.length === 0) return { score: 0, features: [] };

  const features: FeatureExplanation[] = [];
  let totalScore  = 0;
  let totalWeight = 0;

  // Infection-relevant markers get higher weight
  const MARKER_WEIGHTS: Record<string, number> = {
    'wbc': 0.20, 'wbc count': 0.20, 'white blood cell count': 0.20,
    'crp': 0.25, 'c-reactive protein': 0.25, 'c reactive protein': 0.25,
    'procalcitonin': 0.25, 'pct': 0.25,
    'neutrophil': 0.15, 'neutrophil %': 0.15, 'neutrophils': 0.15,
    'esr': 0.10, 'erythrocyte sedimentation rate': 0.10,
    'lactate': 0.20,
  };

  for (const lab of labs) {
    const numVal = parseFloat(lab.value);
    const scorer = findAnalyteScorer(lab.analyte_name);

    let score: number;
    let desc:  string;

    if (scorer && !isNaN(numVal)) {
      const result = scorer(numVal);
      score = result.score;
      desc  = result.desc;
    } else {
      // Fallback to flag-based scoring for unknown analytes
      score = lab.flag === 'CRITICAL' ? 0.80
            : lab.flag === 'ABNORMAL' ? 0.40
            : 0.00;
      desc  = lab.flag === 'CRITICAL' ? 'critical value'
            : lab.flag === 'ABNORMAL' ? 'abnormal value'
            : 'normal';
    }

    const lower = lab.analyte_name.toLowerCase().trim();
    const weight = Object.entries(MARKER_WEIGHTS).find(([k]) =>
      lower.includes(k) || k.includes(lower)
    )?.[1] ?? 0.05; // default weight for non-infection markers

    totalScore  += score * weight;
    totalWeight += weight;

    features.push({
      feature_name: lab.analyte_name,
      contribution: Math.round(score * weight * 1000) / 1000,
      direction:    score > 0.05 ? 'POSITIVE' : 'NEGATIVE',
      rank:         0,
    });
  }

  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  return {
    score:    Math.round(Math.min(normalizedScore, 1) * 1000) / 1000,
    features,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SYMPTOM SCORING
// ═══════════════════════════════════════════════════════════════════════════════

const HIGH_RISK_SYMPTOMS = new Set([
  'fever', 'chills', 'rigors', 'confusion', 'altered mental status',
  'hypotension', 'sepsis', 'shock', 'high fever', 'shaking chills',
  'severe pain', 'difficulty breathing', 'respiratory distress',
]);

const MODERATE_RISK_SYMPTOMS = new Set([
  'cough', 'productive cough', 'dyspnea', 'shortness of breath',
  'tachycardia', 'wound drainage', 'purulent drainage', 'erythema',
  'swelling', 'warmth', 'tenderness', 'diarrhea', 'vomiting',
  'sore throat', 'urinary frequency', 'dysuria', 'flank pain',
  'abdominal pain', 'chest pain', 'wheezing',
]);

function scoreSymptoms(symptoms: string[]): {
  score:    number;
  features: FeatureExplanation[];
} {
  if (symptoms.length === 0) return { score: 0, features: [] };

  const features: FeatureExplanation[] = [];
  let highCount     = 0;
  let moderateCount = 0;
  let lowCount      = 0;

  for (const symptom of symptoms) {
    const lower = symptom.toLowerCase().trim();
    let weight: number;
    let category: string;

    if (HIGH_RISK_SYMPTOMS.has(lower) || [...HIGH_RISK_SYMPTOMS].some(h => lower.includes(h))) {
      weight   = 0.20;
      category = 'high-risk';
      highCount++;
    } else if (MODERATE_RISK_SYMPTOMS.has(lower) || [...MODERATE_RISK_SYMPTOMS].some(m => lower.includes(m))) {
      weight   = 0.10;
      category = 'moderate-risk';
      moderateCount++;
    } else {
      weight   = 0.05;
      category = 'general';
      lowCount++;
    }

    features.push({
      feature_name: `Symptom: ${symptom}`,
      contribution: Math.round(weight * 1000) / 1000,
      direction:    'POSITIVE',
      rank:         0,
    });
  }

  // Base score from weighted symptom count
  let score = Math.min(
    highCount * 0.20 + moderateCount * 0.10 + lowCount * 0.05,
    0.95,
  );

  // Severity multiplier: many symptoms compound the risk
  if (symptoms.length >= 5) score = Math.min(score * 1.30, 0.95);
  else if (symptoms.length >= 3) score = Math.min(score * 1.15, 0.95);

  return {
    score: Math.round(score * 1000) / 1000,
    features,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INTERACTION BONUSES (high-risk combinations)
// ═══════════════════════════════════════════════════════════════════════════════

function scoreInteractions(
  vitals: Record<string, number | undefined>,
  symptoms: string[],
  labs: LabResult[],
): { score: number; features: FeatureExplanation[] } {
  const features: FeatureExplanation[] = [];
  let bonus = 0;

  const temp = vitals.temperature;
  const hr   = vitals.heart_rate;
  const spo2 = vitals.spo2;
  const sbp  = vitals.blood_pressure_systolic;

  const lowerSymptoms = symptoms.map(s => s.toLowerCase());
  const hasFever      = (temp !== undefined && temp > 38.0) || lowerSymptoms.some(s => s.includes('fever'));
  const hasTachycardia = hr !== undefined && hr > 100;

  const labFlags = labs.reduce((acc, l) => {
    const lower = l.analyte_name.toLowerCase();
    if (lower.includes('wbc') || lower.includes('white blood cell')) {
      acc.wbcAbnormal = l.flag !== 'NORMAL';
      acc.wbcValue    = parseFloat(l.value);
    }
    if (lower.includes('crp') || lower.includes('c-reactive')) {
      acc.crpHigh = parseFloat(l.value) > 50;
    }
    if (lower.includes('procalcitonin') || lower === 'pct') {
      acc.pctHigh = parseFloat(l.value) > 0.5;
    }
    if (lower.includes('lactate')) {
      acc.lactateHigh = parseFloat(l.value) > 2.0;
    }
    return acc;
  }, { wbcAbnormal: false, wbcValue: NaN, crpHigh: false, pctHigh: false, lactateHigh: false });

  // SIRS-like combination: fever + tachycardia + elevated WBC
  if (hasFever && hasTachycardia && labFlags.wbcAbnormal) {
    bonus += 0.25;
    features.push({
      feature_name: 'SIRS pattern (fever + tachycardia + abnormal WBC)',
      contribution: 0.25,
      direction:    'POSITIVE',
      rank:         0,
    });
  }

  // Sepsis triad: fever + elevated procalcitonin + hypotension
  if (hasFever && labFlags.pctHigh && sbp !== undefined && sbp < 90) {
    bonus += 0.30;
    features.push({
      feature_name: 'Sepsis risk (fever + elevated procalcitonin + hypotension)',
      contribution: 0.30,
      direction:    'POSITIVE',
      rank:         0,
    });
  }

  // Respiratory infection pattern: low SpO₂ + fever + cough/dyspnea
  const hasRespSymptom = lowerSymptoms.some(s =>
    s.includes('cough') || s.includes('dyspnea') || s.includes('shortness'));
  if (spo2 !== undefined && spo2 < 93 && hasFever && hasRespSymptom) {
    bonus += 0.20;
    features.push({
      feature_name: 'Respiratory infection pattern (hypoxemia + fever + respiratory symptoms)',
      contribution: 0.20,
      direction:    'POSITIVE',
      rank:         0,
    });
  }

  // Combined inflammatory markers: elevated CRP + elevated WBC
  if (labFlags.crpHigh && labFlags.wbcAbnormal) {
    bonus += 0.15;
    features.push({
      feature_name: 'Dual inflammatory marker elevation (CRP + WBC)',
      contribution: 0.15,
      direction:    'POSITIVE',
      rank:         0,
    });
  }

  // Tissue hypoperfusion: elevated lactate + tachycardia
  if (labFlags.lactateHigh && hasTachycardia) {
    bonus += 0.20;
    features.push({
      feature_name: 'Tissue hypoperfusion (elevated lactate + tachycardia)',
      contribution: 0.20,
      direction:    'POSITIVE',
      rank:         0,
    });
  }

  return {
    score:    Math.round(Math.min(bonus, 1) * 1000) / 1000,
    features,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. COMPOSITE SCORING — the main engine
// ═══════════════════════════════════════════════════════════════════════════════

const WEIGHT_VITALS      = 0.30;
const WEIGHT_LAB         = 0.40;
const WEIGHT_SYMPTOMS    = 0.20;
const WEIGHT_INTERACTION = 0.10;

function clinicalPredict(payload: AIPayload): AIResult {
  const vitals   = payload.clinical?.vitals ?? {};
  const symptoms = payload.clinical?.symptoms ?? [];

  // Score each domain
  const vitalResult       = scoreVitals(vitals);
  const labResult         = scoreLabResults(payload.lab);
  const symptomResult     = scoreSymptoms(symptoms);
  const interactionResult = scoreInteractions(vitals, symptoms, payload.lab);

  // Composite weighted score
  let compositeScore =
    vitalResult.score       * WEIGHT_VITALS +
    labResult.score         * WEIGHT_LAB +
    symptomResult.score     * WEIGHT_SYMPTOMS +
    interactionResult.score * WEIGHT_INTERACTION;

  // Clamp to 0–0.98 (leaving room for only the real ML model to hit 1.0)
  compositeScore = Math.round(Math.min(Math.max(compositeScore, 0), 0.98) * 1000) / 1000;

  // No data at all → baseline score with low confidence
  const hasAnyData = Object.values(vitals).some(v => v !== undefined) ||
                     symptoms.length > 0 || payload.lab.length > 0;
  if (!hasAnyData) {
    compositeScore = 0.15; // baseline uncertainty score
  }

  const riskLevel = scoreToLevel(compositeScore);

  // Deterministic confidence based on data availability
  let confidence = 0.55; // base
  if (Object.values(vitals).some(v => v !== undefined)) confidence += 0.15;
  if (payload.lab.length > 0)                           confidence += 0.20;
  if (symptoms.length > 0)                              confidence += 0.05;
  // Small boost for having multiple data sources
  const sourcesPresent = [
    Object.values(vitals).some(v => v !== undefined),
    payload.lab.length > 0,
    symptoms.length > 0,
  ].filter(Boolean).length;
  if (sourcesPresent >= 2) confidence += 0.05;
  confidence = Math.round(Math.min(confidence, 0.95) * 1000) / 1000;

  // Merge and rank all feature explanations
  const allFeatures: FeatureExplanation[] = [
    ...vitalResult.features,
    ...labResult.features,
    ...symptomResult.features,
    ...interactionResult.features,
  ]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .map((f, i) => ({ ...f, rank: i + 1 }));

  // If no features at all, add placeholder entries
  if (allFeatures.length === 0) {
    allFeatures.push(
      { feature_name: 'No clinical data available',  contribution: 0.10, direction: 'POSITIVE', rank: 1 },
      { feature_name: 'No lab results available',    contribution: 0.05, direction: 'NEGATIVE', rank: 2 },
    );
  }

  return {
    risk_score:           compositeScore,
    risk_level:           riskLevel,
    confidence,
    raw_payload: {
      model:            'clinical-scoring-engine',
      model_version:    payload.model_version,
      engine_version:   '1.0.0',
      scoring_weights:  { vitals: WEIGHT_VITALS, lab: WEIGHT_LAB, symptoms: WEIGHT_SYMPTOMS, interaction: WEIGHT_INTERACTION },
      domain_scores:    {
        vitals:      vitalResult.score,
        lab:         labResult.score,
        symptoms:    symptomResult.score,
        interaction: interactionResult.score,
      },
      features:         allFeatures,
    },
    feature_explanations: allFeatures,
  };
}

// ─── Real AI call ─────────────────────────────────────────────────────────────
async function realPredict(payload: AIPayload): Promise<AIResult> {
  const url = `${process.env.AI_SERVICE_URL}/predict`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AIService responded ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    risk_score:           number;
    risk_level:           string;
    confidence:           number;
    raw_payload:          Record<string, unknown>;
    feature_explanations: FeatureExplanation[];
  };

  return {
    risk_score:           data.risk_score,
    risk_level:           data.risk_level as AIResult['risk_level'],
    confidence:           data.confidence,
    raw_payload:          data.raw_payload,
    feature_explanations: data.feature_explanations ?? [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function runPrediction(payload: AIPayload): Promise<AIResult> {
  if (process.env.AI_SERVICE_URL) {
    return realPredict(payload);
  }
  console.log('[AIService] Using clinical scoring engine (rule-based)');
  return clinicalPredict(payload);
}
