import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PDFColumn {
  key: string;
  label: string;
  width?: number;
}

interface ExportPDFButtonProps {
  getData: () => Promise<Record<string, unknown>[]>;
  columns: PDFColumn[];
  filename?: string;
  title?: string;
  className?: string;
}

export function ExportPDFButton({
  getData,
  columns,
  filename = "relatorio",
  title = "Relatório",
  className,
}: ExportPDFButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await getData();
      if (!data.length) {
        toast.warning("Nenhum dado para exportar");
        return;
      }

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // Header navy
      doc.setFillColor(16, 41, 63);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 14);

      // Date
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        14,
        22
      );

      // Cyan accent line
      doc.setFillColor(69, 229, 229);
      doc.rect(0, 28, doc.internal.pageSize.getWidth(), 1.5, "F");

      // Table
      const head = [columns.map((c) => c.label)];
      const body = data.map((row) =>
        columns.map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return "";
          if (Array.isArray(val)) return val.join(", ");
          return String(val);
        })
      );

      autoTable(doc, {
        startY: 34,
        head,
        body,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [229, 229, 229],
          lineWidth: 0.2,
          textColor: [51, 51, 51],
        },
        headStyles: {
          fillColor: [16, 41, 63],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(102, 102, 102);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            doc.internal.pageSize.getWidth() - 14,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" }
          );
          doc.text(
            "GMS — Gestão Mais Simples",
            14,
            doc.internal.pageSize.getHeight() - 8
          );
        },
      });

      doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exportado com sucesso");
    } catch {
      toast.error("Erro ao exportar PDF");
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
        <FileText className="w-4 h-4 mr-2" />
      )}
      Exportar PDF
    </Button>
  );
}
