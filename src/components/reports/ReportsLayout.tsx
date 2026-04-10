import { useLocation, useNavigate } from "react-router-dom";
import { FileSearch, Building2, PieChart, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const REPORT_TABS = [
  { label: "Tickets", path: "/reports/tickets", icon: FileSearch },
  { label: "Volume por Empresa", path: "/reports/company-volume", icon: Building2 },
  { label: "Dashboard Executivo", path: "/reports/executive", icon: PieChart },
];

interface ReportsLayoutProps {
  children: React.ReactNode;
}

export function ReportsLayout({ children }: ReportsLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Report Navigation Bar */}
      <div className="shrink-0 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="px-6">
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto" aria-label="Navegação de relatórios">
            {REPORT_TABS.map((tab) => {
              const isActive = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200",
                    isActive
                      ? "border-[#45E5E5] text-[#10293F] dark:text-white"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive && "text-[#45E5E5]")} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC] dark:bg-background">
        {children}
      </div>
    </div>
  );
}
