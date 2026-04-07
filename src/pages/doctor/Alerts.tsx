import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { alerts as initialAlerts } from "@/data/mockData";

const typeConfig = {
  RESULT_READY: { icon: CheckCircle, color: "text-primary", bgColor: "bg-primary/10 text-primary border-primary/20" },
  ABNORMAL_RESULT: { icon: AlertTriangle, color: "text-risk-moderate", bgColor: "bg-risk-moderate/10 text-risk-moderate border-risk-moderate/20" },
  CRITICAL_RESULT: { icon: AlertCircle, color: "text-destructive", bgColor: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function Alerts() {
  const navigate = useNavigate();
  const [alertList, setAlertList] = useState(initialAlerts);

  const markAsRead = (id: string) => {
    setAlertList((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  };

  const markAllRead = () => {
    setAlertList((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const unreadCount = alertList.filter((a) => !a.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">{unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all as read</Button>
        )}
      </div>
      <div className="space-y-3">
        {alertList.map((alert) => {
          const config = typeConfig[alert.type];
          const Icon = config.icon;
          return (
            <Card
              key={alert.id}
              className={`cursor-pointer transition-all hover:shadow-md ${!alert.read ? "border-l-4 border-l-primary" : "opacity-75"}`}
              onClick={() => {
                markAsRead(alert.id);
                navigate(alert.linkTo);
              }}
            >
              <CardContent className="flex items-start gap-4 py-4">
                <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{alert.title}</span>
                    <Badge className={`border text-[10px] ${config.bgColor}`} variant="outline">
                      {alert.type.replace("_", " ")}
                    </Badge>
                    {!alert.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(alert.date).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
