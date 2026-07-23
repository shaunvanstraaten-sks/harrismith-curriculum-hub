// Moderation templates.
//
// Two modes:
//  - "scored"    → numeric 0..maxScore per item, with total/percentage/status.
//                  Used by Post-Moderation (placeholder until its form lands).
//  - "checklist" → categorical answer per item, grouped in sections. Each item
//                  has an answer "scale". Every answer maps to a compliance value
//                  that is encoded onto the existing moderation_scores columns
//                  with NO schema change:
//                    compliant → (score 1, max 1)
//                    flag      → (score 0, max 1)
//                    na        → (score 0, max 0, i.e. excluded)
//                  A checklist template may show a compliance % (Book Control) or
//                  not (Pre-Moderation), via `showScore`.

export type Compliance = "compliant" | "flag" | "na";

export interface ScaleOption {
  value: string; // stable code, unique within its scale
  labelKey: string; // i18n key
  compliance: Compliance;
}

export type ScaleKey = "yes_no" | "yes_no_na" | "order" | "order_na";

export const SCALES: Record<ScaleKey, ScaleOption[]> = {
  yes_no: [
    { value: "yes", labelKey: "answer.yes", compliance: "compliant" },
    { value: "no", labelKey: "answer.no", compliance: "flag" },
  ],
  yes_no_na: [
    { value: "yes", labelKey: "answer.yes", compliance: "compliant" },
    { value: "no", labelKey: "answer.no", compliance: "flag" },
    { value: "na", labelKey: "answer.na", compliance: "na" },
  ],
  order: [
    { value: "order", labelKey: "answer.order", compliance: "compliant" },
    { value: "attention", labelKey: "answer.attention", compliance: "flag" },
  ],
  order_na: [
    { value: "order", labelKey: "answer.order", compliance: "compliant" },
    { value: "attention", labelKey: "answer.attention", compliance: "flag" },
    { value: "nvt", labelKey: "answer.nvt", compliance: "na" },
  ],
};

export interface ScoredItem {
  key: string;
  labelKey: string;
  maxScore: number;
}

export interface ChecklistItem {
  key: string;
  labelKey: string;
  scale: ScaleKey;
}

export interface ChecklistSection {
  key: string;
  titleKey: string;
  items: ChecklistItem[];
}

export type MetaField =
  | "academic_year"
  | "quarter"
  | "cycle"
  | "weeks"
  | "moderation_date"
  | "grade"
  | "subject"
  | "teacher"
  | "term"
  | "type_of_moderation"
  | "type_of_assessment";

interface BaseTemplate {
  metaFields: MetaField[];
  teacherLabelKey?: string;
}
export interface ScoredTemplate extends BaseTemplate {
  mode: "scored";
  items: ScoredItem[];
}
export interface ChecklistTemplate extends BaseTemplate {
  mode: "checklist";
  showScore: boolean;
  learnersField?: boolean;
  sections: ChecklistSection[];
}
export type Template = ScoredTemplate | ChecklistTemplate;

// ---- Pre-Moderation (checklist, no score) ----
const PRE_MODERATION_SECTIONS: ChecklistSection[] = [
  {
    key: "criteria",
    titleKey: "preSections.criteria",
    items: [
      { key: "topics_addressed", labelKey: "preItems.topics_addressed", scale: "yes_no" },
      { key: "topics_balanced", labelKey: "preItems.topics_balanced", scale: "yes_no" },
    ],
  },
  {
    key: "cognitive_levels",
    titleKey: "preSections.cognitive_levels",
    items: [
      { key: "grid_completed", labelKey: "preItems.grid_completed", scale: "yes_no_na" },
      { key: "grid_weightings", labelKey: "preItems.grid_weightings", scale: "yes_no_na" },
      { key: "reasonable_pass", labelKey: "preItems.reasonable_pass", scale: "yes_no" },
    ],
  },
  {
    key: "cover_page",
    titleKey: "preSections.cover_page",
    items: [
      { key: "cover_form_topic", labelKey: "preItems.cover_form_topic", scale: "yes_no" },
      { key: "cover_time", labelKey: "preItems.cover_time", scale: "yes_no" },
      { key: "cover_marks", labelKey: "preItems.cover_marks", scale: "yes_no" },
      { key: "cover_due_date", labelKey: "preItems.cover_due_date", scale: "yes_no_na" },
      { key: "cover_instructions", labelKey: "preItems.cover_instructions", scale: "yes_no" },
    ],
  },
  {
    key: "quality_questions",
    titleKey: "preSections.quality_questions",
    items: [
      { key: "q_numbering", labelKey: "preItems.q_numbering", scale: "yes_no" },
      { key: "q_instructions_included", labelKey: "preItems.q_instructions_included", scale: "yes_no" },
      { key: "q_instructions_clear", labelKey: "preItems.q_instructions_clear", scale: "yes_no" },
      { key: "q_no_ambiguity", labelKey: "preItems.q_no_ambiguity", scale: "yes_no" },
      { key: "q_visuals_clear", labelKey: "preItems.q_visuals_clear", scale: "yes_no" },
      { key: "q_variety", labelKey: "preItems.q_variety", scale: "yes_no" },
      { key: "q_mark_allocation", labelKey: "preItems.q_mark_allocation", scale: "yes_no" },
      { key: "q_marks_total", labelKey: "preItems.q_marks_total", scale: "yes_no" },
    ],
  },
  {
    key: "quality_memo",
    titleKey: "preSections.quality_memo",
    items: [
      { key: "memo_alternatives", labelKey: "preItems.memo_alternatives", scale: "yes_no" },
      { key: "memo_corresponds", labelKey: "preItems.memo_corresponds", scale: "yes_no" },
    ],
  },
];

export const PRE_MODERATION_TEMPLATE: ChecklistTemplate = {
  mode: "checklist",
  showScore: false,
  teacherLabelKey: "moderation.examiner",
  metaFields: ["subject", "grade", "teacher", "moderation_date", "term", "type_of_moderation", "type_of_assessment"],
  sections: PRE_MODERATION_SECTIONS,
};

// ---- Book Control (checklist, scored — "Interne Moderasie en boekkontrole") ----
const BOOK_CONTROL_SECTIONS: ChecklistSection[] = [
  {
    key: "portfolio",
    titleKey: "bcSections.portfolio",
    items: [
      { key: "portfolio_available", labelKey: "bcItems.portfolio_available", scale: "yes_no" },
      { key: "personal_timetable", labelKey: "bcItems.personal_timetable", scale: "yes_no" },
      { key: "policy_documents", labelKey: "bcItems.policy_documents", scale: "yes_no" },
      { key: "subject_policy", labelKey: "bcItems.subject_policy", scale: "yes_no" },
      { key: "jaarplan", labelKey: "bcItems.jaarplan", scale: "yes_no" },
      { key: "kwartaalbeplanning", labelKey: "bcItems.kwartaalbeplanning", scale: "yes_no" },
      { key: "lesbeplanning", labelKey: "bcItems.lesbeplanning", scale: "yes_no" },
      { key: "dag_tot_dag", labelKey: "bcItems.dag_tot_dag", scale: "yes_no" },
      { key: "assessering", labelKey: "bcItems.assessering", scale: "yes_no_na" },
      { key: "assesseringtake", labelKey: "bcItems.assesseringtake", scale: "yes_no_na" },
      { key: "puntelyste", labelKey: "bcItems.puntelyste", scale: "yes_no_na" },
      { key: "pre_moderering", labelKey: "bcItems.pre_moderering", scale: "yes_no_na" },
      { key: "post_moderering", labelKey: "bcItems.post_moderering", scale: "yes_no_na" },
      { key: "werksverslae", labelKey: "bcItems.werksverslae", scale: "yes_no" },
      { key: "vakvergaderings", labelKey: "bcItems.vakvergaderings", scale: "yes_no" },
    ],
  },
  {
    key: "learner_books",
    titleKey: "bcSections.learner_books",
    items: [
      { key: "books_general", labelKey: "bcItems.books_general", scale: "order" },
      { key: "opskrifte", labelKey: "bcItems.opskrifte", scale: "order_na" },
      { key: "sketse", labelKey: "bcItems.sketse", scale: "order_na" },
      { key: "plakwerk", labelKey: "bcItems.plakwerk", scale: "order_na" },
      { key: "frekwensie", labelKey: "bcItems.frekwensie", scale: "order" },
      { key: "selfkontrole", labelKey: "bcItems.selfkontrole", scale: "order" },
      { key: "onvoltooide", labelKey: "bcItems.onvoltooide", scale: "order" },
      { key: "self_maat", labelKey: "bcItems.self_maat", scale: "order" },
    ],
  },
  {
    key: "teacher_marking",
    titleKey: "bcSections.teacher_marking",
    items: [
      { key: "merkwerk_gereeld", labelKey: "bcItems.merkwerk_gereeld", scale: "order" },
      { key: "kontrole_nasorg", labelKey: "bcItems.kontrole_nasorg", scale: "order" },
      { key: "positiewe_opmerkings", labelKey: "bcItems.positiewe_opmerkings", scale: "order" },
    ],
  },
];

export const BOOK_CONTROL_TEMPLATE: ChecklistTemplate = {
  mode: "checklist",
  showScore: true,
  learnersField: true,
  teacherLabelKey: "moderation.teacherChecked",
  metaFields: ["term", "teacher", "moderation_date", "grade", "subject"],
  sections: BOOK_CONTROL_SECTIONS,
};

// ---- Post-Moderation (scored placeholder until its form is provided) ----
export const POST_MODERATION_TEMPLATE: ScoredTemplate = {
  mode: "scored",
  metaFields: ["academic_year", "quarter", "cycle", "weeks", "moderation_date", "grade", "subject", "teacher"],
  items: [
    { key: "atp_coverage", labelKey: "items.atp_coverage", maxScore: 5 },
    { key: "assessment_quality", labelKey: "items.assessment_quality", maxScore: 5 },
    { key: "learner_books", labelKey: "items.learner_books", maxScore: 5 },
    { key: "evidence", labelKey: "items.evidence", maxScore: 5 },
    { key: "teacher_file", labelKey: "items.teacher_file", maxScore: 5 },
  ],
};

export type ModType = "pre_moderation" | "post_moderation" | "book_control";

export function templateFor(type: ModType): Template {
  if (type === "post_moderation") return POST_MODERATION_TEMPLATE;
  if (type === "book_control") return BOOK_CONTROL_TEMPLATE;
  return PRE_MODERATION_TEMPLATE;
}

/** Flatten checklist items, tagging each with its section, for validation/save. */
export function checklistItemsFlat(tpl: ChecklistTemplate) {
  return tpl.sections.flatMap((sec) =>
    sec.items.map((it) => ({ ...it, sectionKey: sec.key, sectionTitleKey: sec.titleKey })),
  );
}

/** Encode a compliance value onto the existing numeric score columns. */
export function complianceToScore(c: Compliance): { score: number; max: number } {
  if (c === "compliant") return { score: 1, max: 1 };
  if (c === "flag") return { score: 0, max: 1 };
  return { score: 0, max: 0 }; // na → excluded
}

/** Decode the numeric score columns back into a compliance value. */
export function scoreToCompliance(score: number, max: number): Compliance {
  if (max === 0) return "na";
  return score >= 1 ? "compliant" : "flag";
}

/** The scale option matching a compliance value (each scale has one per value). */
export function optionForCompliance(scale: ScaleKey, c: Compliance): ScaleOption | undefined {
  return SCALES[scale].find((o) => o.compliance === c);
}

export function statusFromPercentage(p: number): "green" | "orange" | "red" {
  if (p >= 85) return "green";
  if (p >= 70) return "orange";
  return "red";
}
