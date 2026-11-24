/**
 * Interactive Sims-Style First-Minutes Onboarding & Housewarming Guide.
 *
 * Guides new visitors organically through walking, dressing up their animal,
 * furnishing their home / upgrading a station, visiting Alchemia Town, and
 * shifting Sims moods — rewarding bonus sparks at each milestone so players
 * can immediately unlock their first Lv.2 Station Upgrade!
 */

export type OnboardingStepId = "walk" | "pet" | "furnish" | "town" | "mood";

export interface OnboardingStepDef {
  id: OnboardingStepId;
  title: string;
  desc: string;
  ctaLabel: string;
  rewardSparks: number;
  accent: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    id: "walk",
    title: "Stroll Around Your Lab",
    desc: "Use WASD or click anywhere on the sunlit floor to walk your researcher.",
    ctaLabel: "Walk to Center",
    rewardSparks: 3,
    accent: "#38bdf8"
  },
  {
    id: "pet",
    title: "Meet & Dress Your Pet",
    desc: "Pet your 3D companion or try a knit sweater, mini lab coat & fairy wings!",
    ctaLabel: "Dress Up Pet",
    rewardSparks: 4,
    accent: "#f472b6"
  },
  {
    id: "furnish",
    title: "Furnish Home or Upgrade",
    desc: "Try 43 live 3D furnishings or upgrade a station to Lv.2 in Home Studio.",
    ctaLabel: "Open Furnish",
    rewardSparks: 5,
    accent: "#10b981"
  },
  {
    id: "town",
    title: "Visit Alchemia Town",
    desc: "Explore the growing minted neighborhood & step inside a neighbor's home.",
    ctaLabel: "Explore Town",
    rewardSparks: 6,
    accent: "#6366f1"
  },
  {
    id: "mood",
    title: "Shift Your Sims Mood",
    desc: "Click your glowing Plumbob bar to shift moods, rename yourself, or make friends.",
    ctaLabel: "Open Moods",
    rewardSparks: 5,
    accent: "#a855f7"
  }
];

export const ONBOARDING_GRAND_BONUS_SPARKS = 15;

export interface OnboardingState {
  completed: Record<OnboardingStepId, boolean>;
  dismissed: boolean;
  minimized: boolean;
  grandBonusClaimed: boolean;
}

const ONBOARDING_STORAGE_KEY = "alchemia_onboarding_v1";
let memoryOnboarding: OnboardingState | null = null;

export function createInitialOnboardingState(): OnboardingState {
  return {
    completed: {
      walk: false,
      pet: false,
      furnish: false,
      town: false,
      mood: false
    },
    dismissed: false,
    minimized: false,
    grandBonusClaimed: false
  };
}

export function loadOnboardingState(): OnboardingState {
  if (memoryOnboarding) {
    return {
      ...memoryOnboarding,
      completed: { ...memoryOnboarding.completed }
    };
  }
  const base = createInitialOnboardingState();
  if (typeof window === "undefined") {
    memoryOnboarding = base;
    return base;
  }
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      memoryOnboarding = base;
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    const clean: OnboardingState = {
      completed: {
        ...base.completed,
        ...(parsed.completed || {})
      },
      dismissed: Boolean(parsed.dismissed),
      minimized: Boolean(parsed.minimized),
      grandBonusClaimed: Boolean(parsed.grandBonusClaimed)
    };
    memoryOnboarding = clean;
    return { ...clean, completed: { ...clean.completed } };
  } catch {
    memoryOnboarding = base;
    return base;
  }
}

export function saveOnboardingState(state: OnboardingState): OnboardingState {
  const copy: OnboardingState = {
    ...state,
    completed: { ...state.completed }
  };
  memoryOnboarding = copy;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(copy));
    } catch {
      // safe inside sandboxed NFT iframes
    }
  }
  return copy;
}

export function getOnboardingProgress(state: OnboardingState): {
  doneCount: number;
  totalCount: number;
  pct: number;
  allDone: boolean;
  nextStep: OnboardingStepDef | null;
} {
  const totalCount = ONBOARDING_STEPS.length;
  let doneCount = 0;
  let nextStep: OnboardingStepDef | null = null;
  for (const step of ONBOARDING_STEPS) {
    if (state.completed[step.id]) {
      doneCount++;
    } else if (!nextStep) {
      nextStep = step;
    }
  }
  return {
    doneCount,
    totalCount,
    pct: Math.round((doneCount / totalCount) * 100),
    allDone: doneCount === totalCount,
    nextStep
  };
}

export function completeOnboardingStep(
  state: OnboardingState,
  stepId: OnboardingStepId
): {
  nextState: OnboardingState;
  newlyCompleted: boolean;
  stepReward: number;
  grandBonusAwarded: boolean;
  totalReward: number;
} {
  if (state.completed[stepId]) {
    return {
      nextState: state,
      newlyCompleted: false,
      stepReward: 0,
      grandBonusAwarded: false,
      totalReward: 0
    };
  }
  const def = ONBOARDING_STEPS.find((s) => s.id === stepId);
  const stepReward = def?.rewardSparks ?? 0;
  const nextCompleted = { ...state.completed, [stepId]: true };
  const allDoneNow = ONBOARDING_STEPS.every((s) => nextCompleted[s.id]);
  const grandBonusAwarded = allDoneNow && !state.grandBonusClaimed;
  const totalReward = stepReward + (grandBonusAwarded ? ONBOARDING_GRAND_BONUS_SPARKS : 0);

  const nextState = saveOnboardingState({
    ...state,
    completed: nextCompleted,
    grandBonusClaimed: state.grandBonusClaimed || grandBonusAwarded
  });

  return {
    nextState,
    newlyCompleted: true,
    stepReward,
    grandBonusAwarded,
    totalReward
  };
}
