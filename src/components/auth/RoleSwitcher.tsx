import { useAuth } from "@/contexts/AuthContext";
import { roleLabels } from "@/types/auth";
import { Shield } from "lucide-react";

export function RoleSwitcher() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
      <Shield className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium">
        {roleLabels[user.role] || user.role}
      </span>
    </div>
  );
}
