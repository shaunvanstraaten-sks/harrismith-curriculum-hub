import jsPDF from "jspdf";

export interface PdfSubmission {
  mode?: "scored" | "checklist" | "stats" | "grid";
  showPercentage?: boolean;
  summaryLabel?: string;
  title: string;
  teacherName: string;
  teacherLabel?: string;
  grade: string;
  subject: string;
  academicYear: number;
  quarter: number;
  cycle: number;
  weeks: string;
  date: string;
  headOfSubject: string;
  extraMeta?: Array<[string, string]>;
  scores: Array<{ label: string; score: number; max: number; comment: string }>;
  checklistSections?: Array<{ title: string; items: Array<{ label: string; answer: string }> }>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  generalComments?: string;
  recommendations?: string;
  learnersLabel?: string;
  grid?: {
    className: string;
    term: number;
    questionMaxMarks: (number | null)[];
    students: Array<{ name: string; marks: (number | null)[]; total: number; percentage: number }>;
    columnTotals: number[];
    columnAverages: number[];
  };
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateModerationPdf(s: PdfSubmission) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  const logo = await loadImageAsDataUrl("/hps-logo.jpg");
  if (logo) doc.addImage(logo, "JPEG", 40, y, 50, 50);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Harrismith Primary School", W / 2, y + 18, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Curriculum Moderation Report", W / 2, y + 34, { align: "center" });
  y += 60;

  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(s.title, 40, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const isChecklist = s.mode === "checklist" || s.mode === "stats";
  const isGrid = s.mode === "grid";
  const meta: Array<[string, string]> = isGrid
    ? [
        ["Teacher", s.teacherName],
        ["Grade", s.grade],
        ["Class", s.grid?.className || "—"],
        ["Subject", s.subject],
        ["Term", String(s.grid?.term ?? s.quarter)],
        ["Date", s.date],
      ]
    : [
        [s.teacherLabel ?? (isChecklist ? "Teacher (Examiner)" : "Teacher"), s.teacherName],
        ["Grade", s.grade],
        ["Subject", s.subject],
        ["Academic Year", String(s.academicYear)],
        isChecklist
          ? ["Term", String(s.quarter)]
          : ["Quarter / Cycle / Weeks", `Q${s.quarter} · C${s.cycle} · ${s.weeks}`],
        ["Date", s.date],
        [isChecklist ? "Moderator" : "Head of Subject", s.headOfSubject],
        ...(s.extraMeta ?? []),
      ];
  meta.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, 170, y);
    y += 14;
  });

  y += 10;

  if (isGrid && s.grid) {
    const g = s.grid;
    const qCount = g.questionMaxMarks.length;
    const nameW = 130;
    const colW = Math.min(40, (W - 80 - nameW - 80) / Math.max(qCount, 1));
    const qX = (i: number) => 40 + nameW + i * colW;
    const totalX = 40 + nameW + qCount * colW + 5;
    const pctX = totalX + 40;

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Name", 40, y);
      for (let i = 0; i < qCount; i++) doc.text(String(i + 1), qX(i), y, { align: "center" });
      doc.text("Total", totalX, y, { align: "center" });
      doc.text("%", pctX, y, { align: "center" });
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text("Out of", 40, y);
      for (let i = 0; i < qCount; i++) doc.text(String(g.questionMaxMarks[i] ?? "—"), qX(i), y, { align: "center" });
      doc.setTextColor(0);
      y += 6;
      doc.setDrawColor(200);
      doc.line(40, y, W - 40, y);
      y += 12;
    };

    drawHeader();
    doc.setFontSize(9);
    g.students.forEach((st) => {
      if (y > 750) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      doc.setFont("helvetica", "normal");
      doc.text(st.name, 40, y);
      st.marks.forEach((m, i) => doc.text(m == null ? "—" : String(m), qX(i), y, { align: "center" }));
      doc.setFont("helvetica", "bold");
      doc.text(String(st.total), totalX, y, { align: "center" });
      doc.text(`${st.percentage.toFixed(0)}%`, pctX, y, { align: "center" });
      y += 14;
    });

    y += 4;
    doc.setDrawColor(200);
    doc.line(40, y, W - 40, y);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Total mark", 40, y);
    g.columnTotals.forEach((v, i) => doc.text(v ? String(v) : "—", qX(i), y, { align: "center" }));
    doc.text(String(s.totalScore), totalX, y, { align: "center" });
    doc.text(`${s.percentage.toFixed(0)}%`, pctX, y, { align: "center" });
    y += 14;
    doc.text("Average mark", 40, y);
    g.columnAverages.forEach((v, i) => doc.text(v ? v.toFixed(1) : "—", qX(i), y, { align: "center" }));
    y += 20;
  } else if (isChecklist) {
    (s.checklistSections ?? []).forEach((sec) => {
      if (y > 740) {
        doc.addPage();
        y = 40;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(sec.title, 40, y);
      y += 6;
      doc.setDrawColor(220);
      doc.line(40, y, W - 40, y);
      y += 14;
      doc.setFontSize(10);
      sec.items.forEach((it) => {
        if (y > 760) {
          doc.addPage();
          y = 40;
        }
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(it.label, W - 130);
        doc.text(lines, 40, y);
        doc.setFont("helvetica", "bold");
        doc.text(it.answer, W - 40, y, { align: "right" });
        y += Math.max(lines.length * 12, 12) + 4;
      });
      y += 8;
    });
    if (s.showPercentage) {
      y += 6;
      doc.setDrawColor(200);
      doc.line(40, y, W - 40, y);
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${s.summaryLabel ?? "Compliance"}: ${s.percentage.toFixed(1)}%`, 40, y);
      y += 20;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.text("Scores", 40, y);
    y += 10;
    doc.line(40, y, W - 40, y);
    y += 14;

    doc.setFontSize(10);
    s.scores.forEach((sc) => {
      if (y > 740) {
        doc.addPage();
        y = 40;
      }
      doc.setFont("helvetica", "bold");
      doc.text(sc.label, 40, y);
      doc.text(`${sc.score} / ${sc.max}`, W - 40, y, { align: "right" });
      y += 12;
      if (sc.comment) {
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(sc.comment, W - 80);
        doc.text(lines, 40, y);
        y += lines.length * 12;
      }
      y += 6;
    });

    y += 8;
    doc.line(40, y, W - 40, y);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${s.totalScore} / ${s.maxScore}    Percentage: ${s.percentage.toFixed(1)}%`, 40, y);
    y += 20;
  }

  if (s.generalComments) {
    doc.setFont("helvetica", "bold");
    doc.text(isChecklist ? "Comments" : "General Comments", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.generalComments, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 8;
  }

  if (s.recommendations) {
    doc.setFont("helvetica", "bold");
    doc.text(s.learnersLabel ?? "Recommendations", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.recommendations, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 8;
  }

  y = Math.max(y, 760);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Generated by the Harrismith Primary Curriculum Portal", W / 2, y, {
    align: "center",
  });

  doc.save(`moderation-${s.title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
