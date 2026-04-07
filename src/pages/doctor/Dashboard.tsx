import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Users, FlaskConical, BrainCircuit, Bell, UserPlus, TestTube } from "lucide-react";
import { doctor, patients, labOrders, predictions, alerts } from "@/data/mockData";
import { RiskBadge } from "@/components/doctor/RiskBadge";

export default function Dashboard() {
  const navigate = useNavigate();
  const pendingOrders = labOrders.filter((o) => o.status === "PENDING").length;
  const unreadAlerts = alerts.filter((a) => !a.read);
  const recentPatients = patients.slice(0, 5);
  const recentAlerts = unreadAlerts.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {doctor.name}</h1>
          <p className="text-muted-foreground">Here's an overview of your practice today.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/doctor/patients/new")}>
            <UserPlus className="mr-2 h-4 w-4" /> Add Patient
          </Button>
          <Button variant="outline" onClick={() => navigate("/doctor/patients")}>
            <TestTube className="mr-2 h-4 w-4" /> Order Lab Test
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/doctor/patients")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{patients.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Lab Orders</CardTitle>
            <FlaskConical className="h-4 w-4 text-risk-moderate" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingOrders}</div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/doctor/predictions")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Predictions</CardTitle>
            <BrainCircuit className="h-4 w-4 text-teal" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{predictions.length}</div></CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/doctor/alerts")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread Alerts</CardTitle>
            <Bell className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{unreadAlerts.length}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPatients.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/doctor/patients/${p.id}`)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.age}</TableCell>
                    <TableCell>{p.lastVisit}</TableCell>
                    <TableCell><RiskBadge level={p.riskStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(a.linkTo)}
                >
                  <Bell className={`h-4 w-4 mt-0.5 ${a.type === "CRITICAL_RESULT" ? "text-destructive" : a.type === "ABNORMAL_RESULT" ? "text-risk-moderate" : "text-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
