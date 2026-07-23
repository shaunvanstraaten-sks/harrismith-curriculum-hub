import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const set = (lng: "en" | "af") => {
    i18n.changeLanguage(lng);
    if (typeof window !== "undefined") window.localStorage.setItem("hps.lang", lng);
  };
  const current = i18n.language?.startsWith("af") ? "af" : "en";
  return (
    <div className="inline-flex items-center rounded-md border border-white/20 bg-white/10 text-xs">
      <button
        type="button"
        onClick={() => set("en")}
        className={`px-2 py-1 rounded-l-md ${current === "en" ? "bg-accent text-accent-foreground" : "text-white/80"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => set("af")}
        className={`px-2 py-1 rounded-r-md ${current === "af" ? "bg-accent text-accent-foreground" : "text-white/80"}`}
      >
        AF
      </button>
    </div>
  );
}
