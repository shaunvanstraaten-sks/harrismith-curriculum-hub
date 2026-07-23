// Moderation templates.
//
// Two modes:
//  - "scored"    → numeric 0..maxScore per item, with total/percentage/status.
//                  Used by Post-Moderation and Book Control (unchanged).
//  - "checklist" → Yes/No/N-A per item, grouped in sections, no percentage.
//                  Used by Pre-Moderation (mirrors the school's Google Form).
//
// A checklist answer is stored on the existing moderation_scores columns with
// NO schema change: Yes → (score 1, max 1), No → (score 0, max 1),
// N/A → (score 0, max 0, i.e. excluded). See answerToScore / scoreToAnswer.

export type ChecklistAnswer = "yes" | "no" | "na";

export interface ScoredItem {
  key: string;
  labelKey: string; // i18n key under items.*
  maxScore: number;
}

export interface ChecklistItem {
  key: string;
  labelKey: string; // i18n key under preItems.*
  allowNa?: boolean;
}

export interface ChecklistSection {
  key: string;
  titleKey: string; // i18n key under preSections.*
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
}
export interface ScoredTemplate extends BaseTemplate {
  mode: "scored";
  items: ScoredItem[];
}
export interface ChecklistTemplate extends BaseTemplate {
  mode: "checklist";
  sections: ChecklistSection[];
}
export type Template = ScoredTemplate | ChecklistTemplate;

// ---- Pre-Moderation (checklist) — from "Pre-Moderation Checklist (Subject head)" ----
const PRE_MODERATION_SECTIONS: ChecklistSection[] = [
  {
    key: "criteria",
    titleKey: "preSections.criteria",
    items: [
      { key: "topics_addressed", labelKey: "preItems.topics_addressed" },
      { key: "topics_balanced", labelKey: "preItems.topics_balanced" },
    ],
  },
  {
    key: "cognitive_levels",
    titleKey: "preSections.cognitive_levels",
    items: [
      { key: "grid_completed", labelKey: "preItems.grid_completed", allowNa: true },
      { key: "grid_weightings", labelKey: "preItems.grid_weightings", allowNa: true },
      { key: "reasonable_pass", labelKey: "preItems.reasonable_pass" },
    ],
  },
  {
    key: "cover_page",
    titleKey: "preSections.cover_page",
    items: [
      { key: "cover_form_topic", labelKey: "preItems.cover_form_topic" },
      { key: "cover_time", labelKey: "preItems.cover_time" },
      { key: "cover_marks", labelKey: "preItems.cover_marks" },
      { key: "cover_due_date", labelKey: "preItems.cover_due_date", allowNa: true },
      { key: "cover_instructions", labelKey: "preItems.cover_instructions" },
    ],
  },
  {
    key: "quality_questions",
    titleKey: "preSections.quality_questions",
    items: [
      { key: "q_numbering", labelKey: "preItems.q_numbering" },
      { key: "q_instructions_included", labelKey: "preItems.q_instructions_included" },
      { key: "q_instructions_clear", labelKey: "preItems.q_instructions_clear" },
      { key: "q_no_ambiguity", labelKey: "preItems.q_no_ambiguity" },
      { key: "q_visuals_clear", labelKey: "preItems.q_visuals_clear" },
      { key: "q_variety", labelKey: "preItems.q_variety" },
      { key: "q_mark_allocation", labelKey: "preItems.q_mark_allocation" },
      { key: "q_marks_total", labelKey: "preItems.q_marks_total" },
    ],
  },
  {
    key: "quality_memo",
    titleKey: "preSections.quality_memo",
    items: [
      { key: "memo_alternatives", labelKey: "preItems.memo_alternatives" },
      { key: "memo_corresponds", labelKey: "preItems.memo_corresponds" },
    ],
  },
];

export const PRE_MODERATION_TEMPLATE: ChecklistTemplate = {
  mode: "checklist",
  metaFields: [
    "subject",
    "grade",
    "teacher",
    "moderation_date",
    "term",
    "type_of_moderation",
    "type_of_assessment",
  ],
  sections: PRE_MODERATION_SECTIONS,
};

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

export const BOOK_CONTROL_TEMPLATE: ScoredTemplate = {
  mode: "scored",
  metaFields: ["academic_year", "quarter", "cycle", "weeks", "moderation_date", "grade", "subject", "teacher"],
  items: [
    { key: "learner_books", labelKey: "items.learner_books", maxScore: 5 },
    { key: "evidence", labelKey: "items.evidence", maxScore: 5 },
    { key: "assessment_quality", labelKey: "items.assessment_quality", maxScore: 5 },
  ],
};

export type ModType = "pre_moderation" | "post_moderation" | "book_control";

export function templateFor(type: ModType): Template {
  if (type === "post_moderation") return POST_MODERATION_TEMPLATE;
  if (type === "book_control") return BOOK_CONTROL_TEMPLATE;
  return PRE_MODERATION_TEMPLATE;
}

/** Flatten checklist items, tagging each with its section, for view/PDF grouping. */
export function checklistItemsFlat(tpl: ChecklistTemplate) {
  return tpl.sections.flatMap((sec) =>
    sec.items.map((it) => ({ ...it, sectionKey: sec.key, sectionTitleKey: sec.titleKey })),
  );
}

/** Encode a Yes/No/N-A answer onto the existing numeric score columns. */
export function answerToScore(a: ChecklistAnswer): { score: number; max: number } {
  if (a === "yes") return { score: 1, max: 1 };
  if (a === "no") return { score: 0, max: 1 };
  return { score: 0, max: 0 }; // N/A → excluded
}

/** Decode the numeric score columns back into a Yes/No/N-A answer. */
export function scoreToAnswer(score: number, max: number): ChecklistAnswer {
  if (max === 0) return "na";
  return score >= 1 ? "yes" : "no";
}

export function statusFromPercentage(p: number): "green" | "orange" | "red" {
  if (p >= 85) return "green";
  if (p >= 70) return "orange";
  return "red";
}
