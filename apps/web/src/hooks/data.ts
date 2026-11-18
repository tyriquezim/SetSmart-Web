import {
  addFoodLog,
  addFoodLogs,
  archiveExercise,
  archiveFood,
  createFood,
  deleteFoodLog,
  ensureFoodSaved,
  findSavedFoodByBarcode,
  lookupBarcode,
  getNutritionTargets,
  listFoodLogs,
  listFoods,
  listRecentFoods,
  saveNutritionTargets,
  updateFood,
  updateFoodLog,
  type EnergyUnit,
  type Food,
  type FoodData,
  type FoodLogInput,
  type NutritionTargets,
  deleteBodyWeight,
  listBodyWeights,
  listExerciseSessionStats,
  upsertBodyWeight,
  createExercise,
  deleteRoutine,
  deleteWorkoutSession,
  getProfile,
  getRoutine,
  getWorkoutSession,
  listExercises,
  listRoutines,
  listWorkoutSessions,
  listWorkoutTimes,
  addDays,
  saveRoutine,
  updateExercise,
  updateProfile,
  type ExerciseInput,
  type Profile,
  type RoutineInput,
  type WeightUnit,
} from '@setsmart/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '../auth/context'
import { supabase as db } from '../lib/supabase'

export const keys = {
  profile: ['profile'] as const,
  exercises: ['exercises'] as const,
  routines: ['routines'] as const,
  routine: (id: string) => ['routines', id] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['sessions', id] as const,
  bodyWeights: ['bodyWeights'] as const,
  /** Everything derived from logged sets; invalidate when workouts change. */
  stats: ['stats'] as const,
  /** Prefix for every food-log query (single days and ranges). */
  foodLogs: ['foodLogs'] as const,
  foodLogRange: (from: string, to: string) => ['foodLogs', from, to] as const,
  foods: ['foods'] as const,
  recentFoods: ['foods', 'recent'] as const,
  targets: ['nutritionTargets'] as const,
}

// ---- Profile ---------------------------------------------------------------

export function useProfile() {
  const user = useUser()
  return useQuery({ queryKey: keys.profile, queryFn: () => getProfile(db, user.id) })
}

/** The user's preferred weight unit (defaults to kg while the profile loads). */
export function useWeightUnit(): WeightUnit {
  return useProfile().data?.weightUnit ?? 'kg'
}

/** The user's preferred energy unit (defaults to kJ while the profile loads). */
export function useEnergyUnit(): EnergyUnit {
  return useProfile().data?.energyUnit ?? 'kj'
}

export function useUpdateProfile() {
  const user = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Omit<Profile, 'id'>>) => updateProfile(db, user.id, patch),
    onSuccess: (profile) => qc.setQueryData(keys.profile, profile),
  })
}

// ---- Exercises -------------------------------------------------------------

export function useExercises() {
  return useQuery({ queryKey: keys.exercises, queryFn: () => listExercises(db), staleTime: 5 * 60_000 })
}

export function useCreateExercise() {
  const user = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ExerciseInput) => createExercise(db, user.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.exercises }),
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExerciseInput }) => updateExercise(db, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.exercises }),
  })
}

export function useArchiveExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveExercise(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.exercises }),
  })
}

// ---- Routines --------------------------------------------------------------

export function useRoutines() {
  return useQuery({ queryKey: keys.routines, queryFn: () => listRoutines(db) })
}

export function useRoutine(id: string | undefined) {
  return useQuery({
    queryKey: keys.routine(id ?? ''),
    queryFn: () => getRoutine(db, id!),
    enabled: Boolean(id),
  })
}

export function useSaveRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoutineInput) => saveRoutine(db, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.routines }),
  })
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRoutine(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.routines }),
  })
}

// ---- Workout history -------------------------------------------------------

export function useWorkoutSessions(limit = 20) {
  return useQuery({ queryKey: [...keys.sessions, { limit }], queryFn: () => listWorkoutSessions(db, { limit }) })
}

/** Times, set counts and cardio of workouts on local days `from`..`to` inclusive (YYYY-MM-DD), for energy estimates. */
export function useWorkoutTimes(from: string, to: string = from) {
  return useQuery({
    queryKey: [...keys.sessions, 'times', from, to],
    queryFn: () =>
      listWorkoutTimes(
        db,
        new Date(`${from}T00:00:00`).toISOString(),
        new Date(`${addDays(to, 1)}T00:00:00`).toISOString(),
      ),
  })
}

export function useWorkoutSession(id: string | undefined) {
  return useQuery({
    queryKey: keys.session(id ?? ''),
    queryFn: () => getWorkoutSession(db, id!),
    enabled: Boolean(id),
  })
}

export function useDeleteWorkoutSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkoutSession(db, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.sessions })
      void qc.invalidateQueries({ queryKey: keys.stats })
    },
  })
}

// ---- Progress ----------------------------------------------------------------

/** Per-session stats for every exercise the user has logged, oldest first. */
export function useExerciseStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => listExerciseSessionStats(db) })
}

export function useBodyWeights() {
  return useQuery({ queryKey: keys.bodyWeights, queryFn: () => listBodyWeights(db) })
}

export function useUpsertBodyWeight() {
  const user = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entry: { measuredOn: string; weightKg: number; bodyFatPct?: number | null; note?: string | null }) =>
      upsertBodyWeight(db, user.id, entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bodyWeights }),
  })
}

export function useDeleteBodyWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBodyWeight(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bodyWeights }),
  })
}

// ---- Nutrition ---------------------------------------------------------------

/** Food log entries between two dates inclusive (one day when `to` is omitted). */
export function useFoodLogs(from: string, to: string = from) {
  return useQuery({ queryKey: keys.foodLogRange(from, to), queryFn: () => listFoodLogs(db, from, to) })
}

function useInvalidateFoodLogs() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: keys.foodLogs })
    void qc.invalidateQueries({ queryKey: keys.recentFoods })
  }
}

/**
 * Log a food. Search results are saved to the user's food list first, so
 * the entry links to a food that shows up in recents.
 */
export function useLogFood() {
  const user = useUser()
  const invalidate = useInvalidateFoodLogs()
  return useMutation({
    mutationFn: async ({ food, entry }: { food: FoodData | Food | null; entry: Omit<FoodLogInput, 'foodId'> }) => {
      const saved = food ? await ensureFoodSaved(db, user.id, food) : null
      return addFoodLog(db, user.id, { ...entry, foodId: saved?.id ?? null })
    },
    onSuccess: invalidate,
  })
}

export function useCopyFoodLogs() {
  const user = useUser()
  const invalidate = useInvalidateFoodLogs()
  return useMutation({ mutationFn: (inputs: FoodLogInput[]) => addFoodLogs(db, user.id, inputs), onSuccess: invalidate })
}

export function useUpdateFoodLog() {
  const invalidate = useInvalidateFoodLogs()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<FoodLogInput> }) => updateFoodLog(db, id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteFoodLog() {
  const invalidate = useInvalidateFoodLogs()
  return useMutation({ mutationFn: (id: string) => deleteFoodLog(db, id), onSuccess: invalidate })
}

export function useFoods() {
  return useQuery({ queryKey: keys.foods, queryFn: () => listFoods(db) })
}

export function useRecentFoods() {
  return useQuery({ queryKey: keys.recentFoods, queryFn: () => listRecentFoods(db) })
}

export function useCreateFood() {
  const user = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FoodData) => createFood(db, user.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foods }),
  })
}

export function useUpdateFood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FoodData }) => updateFood(db, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foods }),
  })
}

export function useArchiveFood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveFood(db, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foods }),
  })
}

export function useNutritionTargets() {
  return useQuery({ queryKey: keys.targets, queryFn: () => getNutritionTargets(db) })
}

export function useSaveNutritionTargets() {
  const user = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t: NutritionTargets) => saveNutritionTargets(db, user.id, t),
    onSuccess: (t) => qc.setQueryData(keys.targets, t),
  })
}

/**
 * Find a food by barcode: the user's own foods first (so a custom food with that
 * barcode wins), then Open Food Facts. Resolves to null when nothing matches.
 */
export function useBarcodeLookup() {
  return useMutation({
    mutationFn: async (barcode: string): Promise<Food | FoodData | null> =>
      (await findSavedFoodByBarcode(db, barcode)) ?? (await lookupBarcode(barcode)),
  })
}
