export type WeightUnit = 'kg' | 'lb'
export type EnergyUnit = 'kj' | 'kcal'

export interface Profile {
  id: string
  displayName: string | null
  weightUnit: WeightUnit
  energyUnit: EnergyUnit
}

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Full body',
] as const

export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Smith machine',
  'Kettlebell',
  'Bodyweight',
  'Band',
  'Other',
] as const

export interface Exercise {
  id: string
  /** null for built-in exercises */
  ownerId: string | null
  name: string
  muscleGroup: string
  equipment: string
  archivedAt: string | null
}

/** A planned set in a routine. Weight is always kilograms. */
export interface PlannedSet {
  reps: number
  weightKg: number | null
}

export interface RoutineExercise {
  exerciseId: string
  exercise: Exercise
  restSeconds: number
  sets: PlannedSet[]
  notes: string | null
}

export interface Routine {
  id: string
  name: string
  notes: string | null
  updatedAt: string
  exercises: RoutineExercise[]
}

export interface RoutineSummary {
  id: string
  name: string
  notes: string | null
  updatedAt: string
  exerciseCount: number
}

export interface RoutineInput {
  id: string | null
  name: string
  notes: string | null
  exercises: Array<Pick<RoutineExercise, 'exerciseId' | 'restSeconds' | 'sets' | 'notes'>>
}

export interface WorkoutSessionSummary {
  id: string
  routineId: string | null
  name: string
  startedAt: string
  finishedAt: string
  setCount: number
  /** Sum of reps × weight in kg */
  volumeKg: number
}

export interface LoggedWorkoutSet {
  exerciseId: string
  exerciseName: string
  exercisePosition: number
  setNumber: number
  targetReps: number | null
  targetWeightKg: number | null
  reps: number
  weightKg: number | null
  completedAt: string
}

export interface WorkoutSessionDetail extends WorkoutSessionSummary {
  notes: string | null
  sets: LoggedWorkoutSet[]
}

export interface BodyWeightEntry {
  id: string
  /** Local calendar date, YYYY-MM-DD */
  measuredOn: string
  weightKg: number
  note: string | null
}

/** Aggregates for one exercise within one workout session. */
export interface ExerciseSessionStat {
  exerciseId: string
  sessionId: string
  startedAt: string
  setCount: number
  maxReps: number
  maxWeightKg: number | null
  /** Best Epley estimated one-rep max across sets of 1-12 reps */
  bestE1rmKg: number | null
  volumeKg: number
  totalReps: number
}

/** What the user did previously for an exercise, used during a workout. */
export interface ExerciseHistory {
  lastSets: PlannedSet[]
  lastPerformedAt: string | null
  bestE1rmKg: number | null
  maxWeightKg: number | null
  maxReps: number | null
}
