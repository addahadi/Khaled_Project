import { Badge } from "@/components/ui/badge";
import { getRiskBgColor } from "@/data/mockData";

interface RiskBadgeProps {
  level: string;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  if (level === "NONE") {
    return <Badge variant="secondary">N/A</Badge>;
  }
  return (
    <Badge className={`border ${getRiskBgColor(level)} font-semibold`} variant="outline">
      {level}
    </Badge>
  );
}
