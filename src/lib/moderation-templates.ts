export interface ModerationItem {
  key: string;
  labelKey: string; // i18n key under items.*
  maxScore: number;
}

export const PRE_MODERATION_ITEMS: ModerationItem[] = [
  { key: "assessment_plan", labelKey: "items.assessment_plan", maxScore: 5 },
  { key: "lesson_prep", labelKey: "items.lesson_prep", maxScore: 5 },
  { key: "atp_coverage", labelKey: "items.atp_coverage", maxScore: 5 },
  { key: "assessment_quality", labelKey: "items.assessment_quality", maxScore: 5 },
  { key: "teacher_file", labelKey: "items.teacher_file", maxScore: 5 },
  { key: "resources", labelKey: "items.resources", maxScore: 5 },
];

export const POST_MODERATION_ITEMS: ModerationItem[] = [
  { key: "atp_coverage", labelKey: "items.atp_coverage", maxScore: 5 },
  { key: "assessment_quality", labelKey: "items.assessment_quality", maxScore: 5 },
  { key: "learner_books", labelKey: "items.learner_books", maxScore: 5 },
  { key: "evidence", labelKey: "items.evidence", maxScore: 5 },
  { key: "teacher_file", labelKey: "items.teacher_file", maxScore: 5 },
];

export const BOOK_CONTROL_ITEMS: ModerationItem[] = [
  { key: "learner_books", labelKey: "items.learner_books", maxScore: 5 },
  { key: "evidence", labelKey: "items.evidence", maxScore: 5 },
  { key: "assessment_quality", labelKey: "items.assessment_quality", maxScore: 5 },
];

export function itemsFor(type: "pre_moderation" | "post_moderation" | "book_control") {
  if (type === "post_moderation") return POST_MODERATION_ITEMS;
  if (type === "book_control") return BOOK_CONTROL_ITEMS;
  return PRE_MODERATION_ITEMS;
}

export function statusFromPercentage(p: number): "green" | "orange" | "red" {
  if (p >= 85) return "green";
  if (p >= 70) return "orange";
  return "red";
}
