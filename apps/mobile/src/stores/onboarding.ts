import { create } from 'zustand';

export type CircleChoice = 'create' | 'join' | null;

type OnboardingState = {
  name: string;
  weeklyGoalKm: number;
  choice: CircleChoice;
  circleName: string;
  inviteCode: string | null;

  setName: (v: string) => void;
  setGoal: (v: number) => void;
  setChoice: (v: CircleChoice) => void;
  setCircleName: (v: string) => void;
  setInviteCode: (v: string) => void;
  reset: () => void;
};

const initial = {
  name: '',
  weeklyGoalKm: 40,
  choice: null as CircleChoice,
  circleName: '',
  inviteCode: null as string | null,
};

export const useOnboarding = create<OnboardingState>((set) => ({
  ...initial,
  setName: (name) => set({ name }),
  setGoal: (weeklyGoalKm) => set({ weeklyGoalKm }),
  setChoice: (choice) => set({ choice }),
  setCircleName: (circleName) => set({ circleName }),
  setInviteCode: (inviteCode) => set({ inviteCode }),
  reset: () => set(initial),
}));

export function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
