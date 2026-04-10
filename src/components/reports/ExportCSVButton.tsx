import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CSVColumn {
  key: string;
  label: string;
}

interface ExportCSVButtonProps {
  getData: () => Promise<Record<string, unknown>[]>;
  columns: CSVColumn[];
  filename?: string;
  className?: string;
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportCSVButton({
  getData,
  columns,
  filename = "relatorio",
  className,
}: ExportCSVButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await getData();
      if (!data.length) {
        toast.warning("Nenhum dado para exportar");
        return;
      }

      const header = columns.map((c) => escapeCSV(c.label)).join(",");
      const rows = data.map((row) =>
        columns.map((c) => escapeCSV(row[c.key])).join(",")
      );
      const csv = [header, ...rows].join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Exportação concluída");
    } catch {
      toast.error("Erro ao exportar dados");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className={className}
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      Exportar CSV
    </Button>
  );
}
