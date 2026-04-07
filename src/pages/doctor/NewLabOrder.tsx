import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { patients } from "@/data/mockData";

const testTypes = [
  "Complete Blood Count (CBC)",
  "C-Reactive Protein (CRP)",
  "Procalcitonin",
  "Blood Culture",
  "Urinalysis",
  "Wound Culture",
  "Liver Function Tests",
  "Renal Function Tests",
  "Chest X-Ray",
  "Sputum Culture",
];

export default function NewLabOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === id);

  const [testType, setTestType] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testType) {
      toast.error("Please select a test type.");
      return;
    }
    toast.success("Lab test ordered successfully!");
    navigate(`/doctor/patients/${id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/doctor/patients/${id}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to {patient?.name || "Patient"}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Order Lab Test</CardTitle>
          {patient && <p className="text-sm text-muted-foreground">Patient: {patient.name}</p>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Test Type *</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger><SelectValue placeholder="Select test type" /></SelectTrigger>
                <SelectContent>
                  {testTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical reason or special instructions..." rows={3} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit">Order Test</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/doctor/patients/${id}`)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
