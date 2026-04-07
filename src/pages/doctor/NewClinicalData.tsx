import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { patients } from "@/data/mockData";

const symptomOptions = ["Fever", "Cough", "Dyspnea", "Fatigue", "Chills", "Confusion", "Nausea", "Diarrhea", "Joint pain", "Wound discharge"];

export default function NewClinicalData() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === id);

  const [temperature, setTemperature] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [spO2, setSpO2] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [otherSymptoms, setOtherSymptoms] = useState("");

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) => prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Clinical data recorded successfully!");
    navigate(`/doctor/patients/${id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/doctor/patients/${id}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to {patient?.name || "Patient"}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Add Clinical Data</CardTitle>
          {patient && <p className="text-sm text-muted-foreground">Patient: {patient.name}</p>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold">Vitals</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temp">Temperature (°C)</Label>
                <Input id="temp" type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="36.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hr">Heart Rate (bpm)</Label>
                <Input id="hr" type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="72" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bps">BP Systolic (mmHg)</Label>
                <Input id="bps" type="number" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} placeholder="120" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bpd">BP Diastolic (mmHg)</Label>
                <Input id="bpd" type="number" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} placeholder="80" />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="spo2">SpO2 (%)</Label>
                <Input id="spo2" type="number" value={spO2} onChange={(e) => setSpO2(e.target.value)} placeholder="98" />
              </div>
            </div>

            <h3 className="text-sm font-semibold pt-2">Symptoms</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {symptomOptions.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <Checkbox id={s} checked={selectedSymptoms.includes(s)} onCheckedChange={() => toggleSymptom(s)} />
                  <Label htmlFor={s} className="text-sm font-normal cursor-pointer">{s}</Label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="other">Other Symptoms</Label>
              <Textarea id="other" value={otherSymptoms} onChange={(e) => setOtherSymptoms(e.target.value)} placeholder="Describe any additional symptoms..." rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit">Save Clinical Data</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/doctor/patients/${id}`)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
