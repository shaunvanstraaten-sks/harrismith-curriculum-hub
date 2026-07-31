import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, ExternalLink, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/use-auth";

const CATEGORY = "ATP";

/**
 * Browse + (Admin/Principal) upload curriculum documents for one phase,
 * filtered by Grade then Subject. Reusable across Intermediate/Senior Phase
 * pages — just pass which grade names belong to that phase.
 */
export function AtpResourceBrowser({ phase, gradeNames }: { phase: "intermediate" | "senior"; gradeNames: string[] }) {
  const { t } = useTranslation();
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const canManage = hasAnyRole(roles, ["administrator", "principal"]);

  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => (await supabase.from("grades").select("id, name").order("sort_order")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("id, name").order("name")).data ?? [],
  });
  const gradeOptions = (grades ?? []).filter((g) => gradeNames.includes(g.name));

  const { data: docs, isLoading } = useQuery({
    queryKey: ["resources", phase, CATEGORY, gradeId, subjectId],
    enabled: !!gradeId && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, title, file_path, file_name, created_at")
        .eq("phase", phase)
        .eq("category", CATEGORY)
        .eq("grade_id", gradeId)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const publicUrl = (path: string) => supabase.storage.from("resources").getPublicUrl(path).data.publicUrl;

  const upload = async () => {
    if (!user || !file || !gradeId || !subjectId) return;
    setUploading(true);
    try {
      const path = `${phase}/${CATEGORY}/${gradeId}/${subjectId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("resources").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("resources").insert({
        phase,
        category: CATEGORY,
        grade_id: gradeId,
        subject_id: subjectId,
        title: uploadTitle.trim() || file.name,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;
      toast.success(t("resources.uploadSuccess"));
      setUploadTitle("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["resources", phase, CATEGORY, gradeId, subjectId] });
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="card-elevated p-6 space-y-4">
      <h2 className="text-xl font-semibold">{t("resources.atp")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">{t("moderation.grade")}</span>
          <select
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {gradeOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t("moderation.subject")}</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {(subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!gradeId || !subjectId ? (
        <div className="text-sm text-muted-foreground">{t("resources.selectGradeSubject")}</div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : (docs ?? []).length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("resources.noneForSelection")}</div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {(docs ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium">{d.title}</span>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={publicUrl(d.file_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
                >
                  <ExternalLink size={14} /> {t("common.open")}
                </a>
                <a
                  href={publicUrl(d.file_path)}
                  download={d.file_name}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
                >
                  <Download size={14} /> {t("common.download")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="text-sm font-medium">{t("resources.uploadResource")}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("resources.titleField")}</span>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("resources.file")}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!gradeId || !subjectId || !file || uploading}
            onClick={upload}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Upload size={16} /> {uploading ? t("resources.uploading") : t("resources.uploadResource")}
          </button>
          {(!gradeId || !subjectId) && (
            <div className="text-xs text-muted-foreground">{t("resources.selectGradeSubject")}</div>
          )}
        </div>
      )}
    </section>
  );
}
