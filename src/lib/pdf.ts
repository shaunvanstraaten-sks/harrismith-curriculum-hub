import jsPDF from "jspdf";

export interface PdfSubmission {
  mode?: "scored" | "checklist" | "stats";
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
  const meta: Array<[string, string]> = [
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

  if (isChecklist) {
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
