export type WeightUnit = 'kg' | 'lb'
export type EnergyUnit = 'kj' | 'kcal'

/** Only used by the Mifflin-St Jeor resting energy equation. */
export type Sex = 'male' | 'female'
/** Everyday activity outside logged workouts. */
export type DailyActivity = 'sitting' | 'mixed' | 'active'
/** How hard a typical weights session is. */
export type WorkoutEffort = 'moderate' | 'vigorous'

export interface Profile {
  id: string
  displayName: string | null
  weightUnit: WeightUnit
  energyUnit: EnergyUnit
  heightCm: number | null
  birthYear: number | null
  sex: Sex | null
  dailyActivity: DailyActivity | null
  workoutEffort: WorkoutEffort
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

/** Weights exercises are logged as sets; cardio exercises are timed. */
export type ExerciseKind = 'weights' | 'cardio'

export interface Exercise {
  id: string
  /** null for built-in exercises */
  ownerId: string | null
  name: string
  kind: ExerciseKind
  /** 'Cardio' for cardio exercises */
  muscleGroup: string
  equipment: string
  /** Cardio only: which Compendium activity it counts as for energy estimates */
  cardioActivity: CardioActivity | null
  /** Cardio only, for activity 'other': a MET value the user looked up */
  cardioMet: number | null
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
  /** Empty for cardio exercises */
  sets: PlannedSet[]
  /** Cardio only: the goal duration in seconds, or null for no goal */
  targetDurationS: number | null
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
  exercises: Array<Pick<RoutineExercise, 'exerciseId' | 'restSeconds' | 'sets' | 'targetDurationS' | 'notes'>>
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
  /** Cardio done in this workout, in the order it was done */
  cardio: LoggedCardio[]
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

// ---- Cardio ------------------------------------------------------------------

/** Which Compendium activity a cardio exercise counts as. */
export type CardioActivity =
  | 'run'
  | 'walk'
  | 'hike'
  | 'cycle'
  | 'indoor_cycle'
  | 'row'
  | 'elliptical'
  | 'stairs'
  | 'swim'
  | 'hiit'
  | 'other'

/** How hard a cardio exercise felt; picks a Compendium row when speed can't be used. */
export type CardioEffort = 'light' | 'moderate' | 'vigorous'

/** What's needed to pick a MET value for a piece of cardio. */
export interface CardioMetInput {
  activity: CardioActivity
  durationS: number
  /** Metres; optional */
  distanceM: number | null
  effort: CardioEffort | null
  /** Only for 'other': the exercise's MET value */
  met: number | null
}

/** One cardio exercise done in a logged workout. */
export interface LoggedCardio extends CardioMetInput {
  exerciseId: string
  exerciseName: string
  exercisePosition: number
  /** The routine's goal duration, if it had one */
  targetDurationS: number | null
  /** When the timer was first started */
  startedAt: string
}

export interface BodyWeightEntry {
  id: string
  /** Local calendar date, YYYY-MM-DD */
  measuredOn: string
  weightKg: number
  /** Optional reading from the same weigh-in, e.g. a smart scale */
  bodyFatPct: number | null
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

// ---- Nutrition ---------------------------------------------------------------

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEALS: ReadonlyArray<{ value: Meal; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
]

/** Energy in kJ, macros in grams. */
export interface Nutrients {
  energyKj: number
  proteinG: number
  carbsG: number
  fatG: number
}

/** Per-100 g/ml values as printed on a label; macros may be unknown. */
export interface NutrientsPer100 {
  energyKj: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}

export type FoodSource = 'custom' | 'off' | 'usda'
/** Whether a food is measured by weight or by volume. */
export type BaseUnit = 'g' | 'ml'
/** How the user entered an amount: grams/ml directly, or a number of servings. */
export type AmountUnit = 'g' | 'ml' | 'serving'

/** Everything needed to log a food, whether it came from the database or a search API. */
export interface FoodData {
  source: FoodSource
  /** Barcode for Open Food Facts, fdcId for USDA, null for custom foods */
  sourceId: string | null
  name: string
  brand: string | null
  barcode: string | null
  baseUnit: BaseUnit
  per100: NutrientsPer100
  /** Size of one serving in base units (g or ml) */
  servingSize: number | null
  /** e.g. "2 biscuits" */
  servingLabel: string | null
}

/** A food saved in the user's own food list. */
export interface Food extends FoodData {
  id: string
  archivedAt: string | null
}

export interface FoodLogEntry extends Nutrients {
  id: string
  /** Local calendar date, YYYY-MM-DD */
  eatenOn: string
  meal: Meal
  /** null for quick adds (or if the food was deleted) */
  foodId: string | null
  name: string
  brand: string | null
  amount: number | null
  amountUnit: AmountUnit | null
  /** Grams (or ml) eaten; null for quick adds */
  grams: number | null
  createdAt: string
}

export type FoodLogInput = Omit<FoodLogEntry, 'id' | 'createdAt'>

/** Daily targets; null means "no target set". */
export interface NutritionTargets {
  energyKj: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}
