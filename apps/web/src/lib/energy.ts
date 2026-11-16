import {
  estimateWorkoutEnergy,
  roundEstimate,
  type EnergyUnit,
  type MissingDetail,
  type RestingMethod,
  type WorkoutEnergyEstimate,
  type WorkoutTimes,
} from '@setsmart/core'
import { useBodyWeights, useProfile } from '../hooks/data'
import { energyLabel } from './nutrition'

/** An estimate rounded so it doesn't look more precise than it is, e.g. "2,450 kcal". */
export function formatEstimate(unit: EnergyUnit, kcal: number): string {
  return `${roundEstimate(kcal, unit).toLocaleString()} ${energyLabel(unit)}`
}

export const RESTING_METHOD_LABEL: Record<RestingMethod, string> = {
  cunningham: 'Cunningham equation (from your fat-free mass)',
  mifflin: 'Mifflin-St Jeor equation',
  'mifflin-average': 'Mifflin-St Jeor equation (average of the male and female versions)',
}

const MISSING_LABEL: Record<MissingDetail, string> = {
  weight: 'log your weight',
  height: 'add your height',
  birthYear: 'add your birth year',
}

/** "log your weight, add your height and add your birth year" */
export function describeMissing(missing: MissingDetail[]): string {
  const parts = missing.map((m) => MISSING_LABEL[m])
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** Estimated energy for one workout, or null while loading or without enough body details. */
export function useWorkoutEnergy(workout: WorkoutTimes | undefined): WorkoutEnergyEstimate | null {
  const profile = useProfile()
  const weights = useBodyWeights()
  if (!workout || !profile.data || !weights.data) return null
  return estimateWorkoutEnergy({ workout, profile: profile.data, weights: weights.data })
}
