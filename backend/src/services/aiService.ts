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
  const criticalCount = payload.lab.filter(r => r.flag === 'CRITICAL').length;
  const abnormalCount = payload.lab.filter(r => r.flag === 'ABNORMAL').length;

  const baseScore = Math.min(
    0.1 + criticalCount * 0.25 + abnormalCount * 0.1 +
    (payload.clinical?.symptoms?.length ?? 0) * 0.05,
    0.99
  );

  const riskLevel = scoreToLevel(baseScore);

  const features: FeatureExplanation[] = [
    ...payload.lab.map((r, i) => ({
      feature_name: r.analyte_name,
      contribution: r.flag === 'CRITICAL' ? 0.25 : r.flag === 'ABNORMAL' ? 0.10 : 0.01,
      direction:    (r.flag !== 'NORMAL' ? 'POSITIVE' : 'NEGATIVE') as FeatureExplanation['direction'],
      rank:         i + 1,
    })),
    ...(payload.clinical?.symptoms ?? []).map((s, i) => ({
      feature_name: `Symptom: ${s}`,
      contribution: 0.05,
      direction:    'POSITIVE' as FeatureExplanation['direction'],
      rank:         payload.lab.length + i + 1,
    })),
  ].sort((a, b) => b.contribution - a.contribution)
   .map((f, i) => ({ ...f, rank: i + 1 }));

  return {
    risk_score:           Math.round(baseScore * 1000) / 1000,
    risk_level:           riskLevel,
    confidence:           0.87,
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
  if (process.env.AI_SERVICE_URL) {
    return realPredict(payload);
  }
  console.warn('[AIService] AI_SERVICE_URL not set — using mock predictor');
  return mockPredict(payload);
}
