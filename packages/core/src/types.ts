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
