/**
 * Lightweight assertions for activity typeahead.
 * Run: pnpm exec tsc -p packages/shared --noEmit && node --import tsx packages/shared/src/activity.search.test.ts
 * or via the repo test helper below.
 */
import {
  activitySearchMatches,
  buildActivitySearchHaystack,
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
    major_heading: partial.major_heading ?? "sports",
    category: partial.category ?? "other",
    met_value: partial.met_value ?? 5,
    sort_order: partial.sort_order ?? 0,
    owner_coach_id: partial.owner_coach_id ?? null,
    ...partial,
  };
}

const items = [
  sample({ id: "1", name_ru: "Бег, общий", name_en: "Running, general", met_value: 7 }),
  sample({ id: "2", name_ru: "Ходьба", name_en: "Walking", met_value: 3.5 }),
  sample({ id: "3", name_ru: "Бокс, груша", name_en: "Boxing, punching bag", met_value: 5.5 }),
  sample({ id: "4", name_ru: "Йога", name_en: "Yoga", met_value: 2.5 }),
  sample({
    id: "5",
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

const suggested = pickSuggestedActivityTypes(items, 4);
assert(suggested.length >= 3, "suggested returns several pins");
assert(
  suggested.every((item) => item.owner_coach_id == null),
  "suggested excludes custom workouts",
);
assert(
  new Set(suggested.map((item) => item.id)).size === suggested.length,
  "suggested ids unique",
);

console.log("activity.search.test.ts: ok");
