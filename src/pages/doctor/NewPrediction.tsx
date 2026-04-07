import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { patients, clinicalDataRecords, labResults } from "@/data/mockData";

export default function NewPrediction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("patient") || "";

  const [patientId, setPatientId] = useState(preselected);
  const [processing, setProcessing] = useState(false);

  const hasClinical = clinicalDataRecords.some((c) => c.patientId === patientId);
  const hasLab = labResults.some((r) => r.patientId === patientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error("Please select a patient.");
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      toast.success("Prediction completed!");
      navigate("/doctor/predictions/pred1");
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/doctor/predictions")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Predictions
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>New Prediction Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Patient *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Choose a patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {patientId && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <h4 className="text-sm font-semibold">Readiness Check</h4>
                  <div className="flex items-center gap-2 text-sm">
                    {hasClinical ? <CheckCircle className="h-4 w-4 text-teal" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span>Clinical data {hasClinical ? "available" : "missing"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {hasLab ? <CheckCircle className="h-4 w-4 text-teal" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span>Lab results {hasLab ? "available" : "missing"}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={processing || !patientId}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {processing ? "Processing..." : "Run Prediction"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/doctor/predictions")}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
