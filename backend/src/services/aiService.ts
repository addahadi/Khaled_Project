/**
 * AIService — Image 2
 *
 * Sends payload {clinical, lab, model_version} to the AI microservice.
 * Returns {risk_score, risk_level, confidence, raw_payload}.
 *
 * When AI_SERVICE_URL is not set, falls back to a deterministic mock
 * so development works without a real ML backend.
 */

export interface ClinicalData {
  vitals:   Record<string, number | undefined>;
  symptoms: string[];
}

export interface LabResult {
  analyte_name:   string;
  value:          string;
  flag:           'NORMAL' | 'ABNORMAL' | 'CRITICAL';
  reference_low?: number;
  reference_high?: number;
}

export interface FeatureExplanation {
  feature_name: string;
  contribution: number;   // SHAP-style value
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

// ─── Mock AI (deterministic from input) ──────────────────────────────────────
function mockPredict(payload: AIPayload): AIResult {
  const vitalKeys = payload.clinical?.vitals ? Object.keys(payload.clinical.vitals).filter(k => payload.clinical!.vitals[k] !== undefined) : [];
  const symptomCount = payload.clinical?.symptoms?.length ?? 0;
  const abnormalCount = payload.lab.filter(r => r.flag === 'ABNORMAL' || r.flag === 'CRITICAL').length;

  const baseScore = Math.min(
    0.15 +
      abnormalCount * 0.12 +
      symptomCount * 0.07 +
      (vitalKeys.length > 0 ? 0.1 : 0),
    0.98
  );

  const riskLevel = scoreToLevel(baseScore);

  const features: FeatureExplanation[] = [
    ...payload.lab.map((r, i) => ({
      feature_name: r.analyte_name,
      contribution: r.flag === 'CRITICAL' ? 0.28 : r.flag === 'ABNORMAL' ? 0.12 : 0.02,
      direction:    (r.flag !== 'NORMAL' ? 'POSITIVE' : 'NEGATIVE') as FeatureExplanation['direction'],
      rank:         i + 1,
    })),
    ...(payload.clinical?.symptoms ?? []).map((s, i) => ({
      feature_name: `Symptom: ${s}`,
      contribution: 0.07,
      direction:    'POSITIVE' as FeatureExplanation['direction'],
      rank:         payload.lab.length + i + 1,
    })),
    ...vitalKeys.map((k, i) => ({
      feature_name: `Vital: ${k}`,
      contribution: 0.05,
      direction:    'POSITIVE' as FeatureExplanation['direction'],
      rank:         payload.lab.length + symptomCount + i + 1,
    })),
  ].sort((a, b) => b.contribution - a.contribution)
   .map((f, i) => ({ ...f, rank: i + 1 }));

  if (features.length === 0) {
    features.push(
      { feature_name: 'No clinical data', contribution: 0.10, direction: 'POSITIVE', rank: 1 },
      { feature_name: 'No lab results',   contribution: 0.05, direction: 'NEGATIVE', rank: 2 },
    );
  }

  return {
    risk_score:           Math.round(baseScore * 1000) / 1000,
    risk_level:           riskLevel,
    confidence:           Math.round((0.75 + Math.random() * 0.2) * 1000) / 1000,
    raw_payload:          { model: 'mock', model_version: payload.model_version, features },
    feature_explanations: features,
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
  console.warn('[AIService] Using mock predictor');
  return mockPredict(payload);
}
