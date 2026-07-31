import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DbeBanner } from "@/components/DbeBanner";

export const Route = createFileRoute("/_authenticated/resources/intermediate")({
  component: IntermediatePhaseResources,
  head: () => ({
    meta: [{ title: "Intermediate Phase Resources — Harrismith Primary" }, { name: "robots", content: "noindex" }],
  }),
});

function IntermediatePhaseResources() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <DbeBanner />
      <div>
        <div className="text-sm text-muted-foreground">{t("nav.resources")}</div>
        <h1 className="text-3xl font-bold">{t("resources.intermediatePhase")}</h1>
      </div>
      <div className="card-elevated p-10 text-center text-muted-foreground">{t("resources.empty")}</div>
    </div>
  );
}
