import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { predictions } from "@/data/mockData";
import { RiskBadge } from "@/components/doctor/RiskBadge";

export default function PredictionsList() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Predictions</h1>
        <Button onClick={() => navigate("/doctor/predictions/new")}>
          <Plus className="mr-2 h-4 w-4" /> New Prediction
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictions.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/doctor/predictions/${p.id}`)}>
                  <TableCell className="font-medium">{p.patientName}</TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell><RiskBadge level={p.riskLevel} /></TableCell>
                  <TableCell>{p.riskScore}/100</TableCell>
                  <TableCell>{p.confidence}%</TableCell>
                  <TableCell>
                    <span className={`text-sm font-medium ${p.status === "COMPLETED" ? "text-teal" : "text-risk-moderate"}`}>
                      {p.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
