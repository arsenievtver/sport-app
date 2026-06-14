export const ONBOARDING_STEPS = ["gender", "birth", "focus", "weight", "goal"] as const;

export type Step = (typeof ONBOARDING_STEPS)[number];
