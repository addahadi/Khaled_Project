import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { predictions, patients, getRiskColor } from "@/data/mockData";
import { RiskBadge } from "@/components/doctor/RiskBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

export default function PredictionResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prediction = predictions.find((p) => p.id === id);

  if (!prediction) {
    return <div className="text-center py-12 text-muted-foreground">Prediction not found.</div>;
  }

  const patient = patients.find((p) => p.id === prediction.patientId);

  const gaugeColor = prediction.riskLevel === "LOW" ? "hsl(var(--risk-low))" :
    prediction.riskLevel === "MODERATE" ? "hsl(var(--risk-moderate))" :
    prediction.riskLevel === "HIGH" ? "hsl(var(--risk-high))" : "hsl(var(--risk-critical))";

  const chartData = prediction.featureContributions
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .map((f) => ({ ...f, absContribution: Math.abs(f.contribution) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/doctor/predictions")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Prediction Result</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Risk Score */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Risk Assessment</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke={gaugeColor} strokeWidth="10"
                  strokeDasharray={`${(prediction.riskScore / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold" style={{ color: gaugeColor }}>{prediction.riskScore}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <RiskBadge level={prediction.riskLevel} />
            <p className="text-sm text-muted-foreground">Confidence: <span className="font-semibold text-foreground">{prediction.confidence}%</span></p>
          </CardContent>
        </Card>

        {/* XAI Feature Explanation */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Feature Contributions (XAI)
            </CardTitle>
            <p className="text-xs text-muted-foreground">How each feature contributed to the risk score. Positive = increases risk, Negative = decreases risk.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" domain={[-0.35, 0.35]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} className="text-xs" />
                  <YAxis type="category" dataKey="feature" width={90} className="text-xs" />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                  <ReferenceLine x={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="contribution" radius={[4, 4, 4, 4]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.contribution >= 0 ? "hsl(var(--risk-high))" : "hsl(var(--teal))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient Context */}
        {patient && (
          <Card>
            <CardHeader><CardTitle className="text-base">Patient Context</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {patient.name}</p>
              <p><span className="text-muted-foreground">Age:</span> {patient.age}</p>
              <p><span className="text-muted-foreground">Gender:</span> {patient.gender}</p>
              <p><span className="text-muted-foreground">History:</span> {patient.medicalHistory}</p>
            </CardContent>
          </Card>
        )}

        {/* Model Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Model Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Model Version:</span> {prediction.modelVersion}</p>
            <p><span className="text-muted-foreground">Prediction Date:</span> {prediction.date}</p>
            <p><span className="text-muted-foreground">Status:</span> {prediction.status}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
