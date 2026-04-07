import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, TestTube, BrainCircuit } from "lucide-react";
import { patients, clinicalDataRecords, labOrders, labResults, predictions } from "@/data/mockData";
import { RiskBadge } from "@/components/doctor/RiskBadge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === id);

  if (!patient) {
    return <div className="text-center py-12 text-muted-foreground">Patient not found.</div>;
  }

  const clinicalData = clinicalDataRecords.filter((c) => c.patientId === id);
  const patientLabOrders = labOrders.filter((o) => o.patientId === id);
  const patientResults = labResults.filter((r) => r.patientId === id);
  const patientPredictions = predictions.filter((p) => p.patientId === id);

  const riskHistory = patientPredictions.map((p) => ({
    date: p.date,
    score: p.riskScore,
  })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/doctor/patients")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{patient.name}</h1>
          <p className="text-muted-foreground">{patient.age} yrs · {patient.gender} · Last visit: {patient.lastVisit}</p>
        </div>
        <RiskBadge level={patient.riskStatus} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Medical History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{patient.medicalHistory || "No medical history recorded."}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate(`/doctor/patients/${id}/clinical-data/new`)}>
          <Plus className="mr-1 h-3 w-3" /> Add Clinical Data
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate(`/doctor/patients/${id}/lab-orders/new`)}>
          <TestTube className="mr-1 h-3 w-3" /> Order Lab Test
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate(`/doctor/predictions/new?patient=${id}`)}>
          <BrainCircuit className="mr-1 h-3 w-3" /> Request Prediction
        </Button>
      </div>

      <Tabs defaultValue="clinical">
        <TabsList>
          <TabsTrigger value="clinical">Clinical Data</TabsTrigger>
          <TabsTrigger value="labs">Lab Orders ({patientLabOrders.length})</TabsTrigger>
          <TabsTrigger value="risk">Risk History</TabsTrigger>
        </TabsList>

        <TabsContent value="clinical">
          <Card>
            <CardContent className="pt-6">
              {clinicalData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No clinical data recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Temp (°C)</TableHead>
                      <TableHead>HR (bpm)</TableHead>
                      <TableHead>BP (mmHg)</TableHead>
                      <TableHead>SpO2 (%)</TableHead>
                      <TableHead>Symptoms</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinicalData.map((cd) => (
                      <TableRow key={cd.id}>
                        <TableCell>{cd.date}</TableCell>
                        <TableCell className={cd.temperature >= 38 ? "text-risk-high font-medium" : ""}>{cd.temperature}</TableCell>
                        <TableCell className={cd.heartRate >= 100 ? "text-risk-high font-medium" : ""}>{cd.heartRate}</TableCell>
                        <TableCell>{cd.bloodPressureSystolic}/{cd.bloodPressureDiastolic}</TableCell>
                        <TableCell className={cd.spO2 < 92 ? "text-risk-critical font-medium" : ""}>{cd.spO2}</TableCell>
                        <TableCell><div className="flex flex-wrap gap-1">{cd.symptoms.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {patientLabOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No lab orders.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test Type</TableHead>
                        <TableHead>Ordered</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientLabOrders.map((lo) => (
                        <TableRow key={lo.id}>
                          <TableCell className="font-medium">{lo.testType}</TableCell>
                          <TableCell>{lo.orderedDate}</TableCell>
                          <TableCell>
                            <Badge variant={lo.status === "COMPLETED" ? "default" : "secondary"}>
                              {lo.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{lo.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {patientResults.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold pt-4">Lab Results</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Test</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Flag</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {patientResults.map((lr) => (
                            <TableRow key={lr.id}>
                              <TableCell className="font-medium">{lr.testType}</TableCell>
                              <TableCell>{lr.value}</TableCell>
                              <TableCell>{lr.unit}</TableCell>
                              <TableCell className="text-muted-foreground">{lr.referenceRange}</TableCell>
                              <TableCell>
                                <Badge className={`border ${lr.flag === "NORMAL" ? "bg-risk-low/10 text-risk-low border-risk-low/20" : lr.flag === "ABNORMAL" ? "bg-risk-moderate/10 text-risk-moderate border-risk-moderate/20" : "bg-risk-critical/10 text-risk-critical border-risk-critical/20"}`} variant="outline">
                                  {lr.flag}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardContent className="pt-6">
              {riskHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No prediction history.</p>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={riskHistory}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[0, 100]} className="text-xs" />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" name="Risk Score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
