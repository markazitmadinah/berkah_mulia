import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportColumn {
  header: string;
  dataKey: string;
}

interface SummaryItem {
  label: string;
  value: string;
}

const EMERALD: [number, number, number] = [4, 120, 87];

export function exportTablePdf(
  title: string,
  subtitle: string,
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, string | number | null | undefined>[],
  summary?: SummaryItem[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header / branding
  doc.setFillColor(...EMERALD);
  doc.rect(0, 0, pageWidth, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KOPERASI BERKAH MULIA', 40, 36);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Simpan Pinjam Syariah · Emas & Qurban', 40, 52);
  doc.text(new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - 40, 40, { align: 'right' });

  // Title
  let y = 110;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, y);
  y += 18;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 40, y);
  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(40, y, pageWidth - 40, y);

  // Summary box (rekap uang masuk/keluar)
  if (summary && summary.length) {
    y += 16;
    const rowsNeeded = Math.ceil(summary.length / 2);
    const boxH = 26 + rowsNeeded * 22;
    doc.setFillColor(239, 246, 245);
    doc.roundedRect(40, y - 6, pageWidth - 80, boxH, 6, 6, 'F');
    const colW = (pageWidth - 100) / 2;
    summary.forEach((s, i) => {
      const cx = 52 + (i % 2) * colW;
      const cy = y + Math.floor(i / 2) * 22;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text(s.label.toUpperCase(), cx, cy);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(s.value, cx, cy + 13);
    });
    y += boxH + 10;
  }

  // Table
  autoTable(doc, {
    startY: y + 12,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => (r[c.dataKey] === null || r[c.dataKey] === undefined ? '-' : String(r[c.dataKey])))),
    theme: 'grid',
    headStyles: { fillColor: EMERALD, textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8.5, textColor: 30, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 } },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { lineColor: [203, 213, 225], lineWidth: 0.5 },
    margin: { left: 40, right: 40, top: 90, bottom: 50 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Dokumen ini dibuat otomatis oleh sistem Koperasi Berkah Mulia — hal ${doc.getNumberOfPages()}`, 40, pageHeight - 25);
      doc.text(documentTitleFor(title, doc.getNumberOfPages()), pageWidth - 40, pageHeight - 25, { align: 'right' });
    },
  });

  doc.save(filename);
}

function documentTitleFor(title: string, page: number): string {
  return `${title} — ${page}`;
}
