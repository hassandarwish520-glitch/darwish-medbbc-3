// SM-2 spaced-repetition helper (mirrors src/app/api/flashcards/review/route.ts)
// Exposed as client-side fallback so the Study screen can preview the next
// scheduled date even before the server round-trip completes.
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

export type CardScheduleState = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
};

export interface SpacedRepetitionState extends CardScheduleState {
  lastGrade: Grade | null;
}

export const SCHEDULE_PRESETS: Record<Grade, { label: string; emoji: string; tint: string; description: string; nextIntervalDays: number }> = {
  0:  { label: "Again",     emoji: "😰", tint: "rose",   description: "Forgot completely — back into rotation now",  nextIntervalDays: 1 },
  1:  { label: "Wrong",     emoji: "😟", tint: "rose",   description: "Recall failed — review tomorrow",             nextIntervalDays: 1 },
  2:  { label: "Hard",      emoji: "😐", tint: "amber",  description: "Hard recall — short interval",                nextIntervalDays: 2 },
  3:  { label: "Hard",      emoji: "😐", tint: "amber",  description: "Hard recall — short interval",                nextIntervalDays: 4 },
  4:  { label: "Good",      emoji: "🙂", tint: "blue",   description: "Recalled with some effort",                   nextIntervalDays: 8 },
  5:  { label: "Easy",      emoji: "😄", tint: "emerald",description: "Perfect recall — long interval",              nextIntervalDays: 14 },
};

export const GRADE_OPTIONS: { value: Grade; label: string; emoji: string; tint: string }[] = [
  { value: 0, label: "Again", emoji: "😰", tint: "rose" },
  { value: 2, label: "Hard",  emoji: "😐", tint: "amber" },
  { value: 4, label: "Good",  emoji: "🙂", tint: "blue" },
  { value: 5, label: "Easy",  emoji: "😄", tint: "emerald" },
];

export function sm2(
  state: Pick<SpacedRepetitionState, "ease" | "intervalDays" | "repetitions">,
  grade: Grade,
): SpacedRepetitionState {
  let ease = state.ease;
  let reps = state.repetitions;
  let interval = state.intervalDays;
  if (grade < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }
  const due = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();
  return { ease, intervalDays: interval, repetitions: reps, dueAt: due, lastGrade: grade };
}

export function nextSchedulePreview(
  state: Pick<SpacedRepetitionState, "ease" | "intervalDays" | "repetitions">,
  grade: Grade,
): string {
  const result = sm2(state, grade);
  return result.dueAt;
}
