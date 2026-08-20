/** What the planner asks the model for, and what it hands back. */

export type WorkoutDayKind = 'strength' | 'cardio' | 'active-rest' | 'rest';

export type PlannedExercise = {
  /** Stable within a plan, so logged reps stay attached to the right row. */
  id: string;
  name: string;
  /** Free text rather than a number: "3", "3-4", "amennyi jólesik". */
  sets: string;
  reps: string;
  /** Short cue or substitution, e.g. "lassú leengedés". */
  note?: string;
};

export type PlannedDay = {
  id: string;
  /** 0 = hétfő, matching how the rest of the app counts weekdays. */
  weekday: number;
  kind: WorkoutDayKind;
  title: string;
  focus?: string;
  durationMin?: number;
  exercises: PlannedExercise[];
};

export type WorkoutPlanRequest = {
  /** What the user typed. */
  prompt: string;
  /**
   * Assembled from the profile on the client. The brief calls for the IBD
   * status to reach the model without the UI asking for it again.
   */
  context?: string;
};

export type WorkoutPlan = {
  /** One short sentence about the week as a whole. */
  summary: string;
  days: PlannedDay[];
};

export type WorkoutPlanResponse = WorkoutPlan | { error: string };
