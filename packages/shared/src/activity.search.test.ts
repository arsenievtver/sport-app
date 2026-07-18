/**
 * Lightweight assertions for activity typeahead.
 * Run: pnpm dlx tsx packages/shared/src/activity.search.test.ts
 */
import {
  activitySearchMatches,
  buildActivitySearchHaystack,
  filterActivityTypesForPicker,
  isPickerAllowedMajorHeading,
  normalizeActivitySearchText,
  pickSuggestedActivityTypes,
  type ActivityType,
} from "./activity";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sample(partial: Partial<ActivityType> & Pick<ActivityType, "id" | "name_ru" | "name_en">): ActivityType {
  return {
    compendium_code: partial.compendium_code ?? "0000",
    major_heading: partial.major_heading ?? "Sports",
    category: partial.category ?? "other",
    met_value: partial.met_value ?? 5,
    sort_order: partial.sort_order ?? 0,
    owner_coach_id: partial.owner_coach_id ?? null,
    ...partial,
  };
}

const items = [
  sample({ id: "1", name_ru: "Бег, общий", name_en: "Running, general", major_heading: "Running", met_value: 7 }),
  sample({ id: "2", name_ru: "Ходьба", name_en: "Walking", major_heading: "Walking", met_value: 3.5 }),
  sample({
    id: "3",
    name_ru: "Бокс, груша",
    name_en: "Boxing, punching bag",
    major_heading: "Sports",
    met_value: 5.5,
  }),
  sample({
    id: "4",
    name_ru: "Йога",
    name_en: "Yoga",
    major_heading: "Conditioning Exercise",
    met_value: 2.5,
  }),
  sample({
    id: "5",
    name_ru: "Мытьё полов",
    name_en: "Floor mopping",
    major_heading: "Home Activities",
    met_value: 3,
  }),
  sample({
    id: "6",
    name_ru: "Моя тренировка",
    name_en: "Custom",
    major_heading: "custom",
    category: "custom",
    owner_coach_id: "coach-1",
  }),
];

assert(normalizeActivitySearchText("  Бег, общий! ") === "бег общий", "normalize strips punctuation");
assert(activitySearchMatches(buildActivitySearchHaystack(items[0]), "бег"), "ru name matches");
assert(activitySearchMatches(buildActivitySearchHaystack(items[0]), "running"), "en name matches");
assert(activitySearchMatches(buildActivitySearchHaystack(items[0]), "run"), "alias run → бег/running");
assert(activitySearchMatches(buildActivitySearchHaystack(items[2]), "boxing"), "boxing alias");
assert(activitySearchMatches(buildActivitySearchHaystack(items[2]), "груша"), "colloquial груша");
assert(!activitySearchMatches(buildActivitySearchHaystack(items[1]), "yoga"), "non-match");

assert(isPickerAllowedMajorHeading("Running"), "running allowed");
assert(!isPickerAllowedMajorHeading("Home Activities"), "home excluded");

const filtered = filterActivityTypesForPicker(items);
assert(
  filtered.every((item) => item.id !== "5"),
  "picker filter drops home activities",
);
assert(
  filtered.some((item) => item.id === "6"),
  "picker filter keeps custom workouts",
);

const suggested = pickSuggestedActivityTypes(items, 4);
assert(suggested.length >= 3, "suggested returns several pins");
assert(
  suggested.every((item) => item.owner_coach_id == null && item.major_heading !== "Home Activities"),
  "suggested excludes custom + disallowed headings",
);
assert(
  new Set(suggested.map((item) => item.id)).size === suggested.length,
  "suggested ids unique",
);

console.log("activity.search.test.ts: ok");
