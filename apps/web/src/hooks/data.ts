import {
  archiveExercise,
  createExercise,
  deleteRoutine,
  deleteWorkoutSession,
  getProfile,
  getRoutine,
  getWorkoutSession,
  listExercises,
  listRoutines,
  listWorkoutSessions,
  saveRoutine,
  updateExercise,
  updateProfile,
  type ExerciseInput,
  type Profile,
  type RoutineInput,
  type WeightUnit,
} from '@gymbro/core'
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
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions }),
  })
}
