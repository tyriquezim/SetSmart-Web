import type { Profile } from '../types'
import { unwrap, type Client } from './client'

interface ProfileRow {
  id: string
  display_name: string | null
  weight_unit: Profile['weightUnit']
  energy_unit: Profile['energyUnit']
  height_cm: number | string | null
  birth_year: number | null
  sex: Profile['sex']
  daily_activity: Profile['dailyActivity']
  workout_effort: Profile['workoutEffort']
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  weightUnit: r.weight_unit,
  energyUnit: r.energy_unit,
  heightCm: r.height_cm == null ? null : Number(r.height_cm),
  birthYear: r.birth_year,
  sex: r.sex,
  dailyActivity: r.daily_activity,
  workoutEffort: r.workout_effort ?? 'moderate',
})

export async function getProfile(db: Client, userId: string): Promise<Profile> {
  const row = unwrap<ProfileRow>(await db.from('profiles').select('*').eq('id', userId).single())
  return toProfile(row)
}

export async function updateProfile(
  db: Client,
  userId: string,
  patch: Partial<Omit<Profile, 'id'>>,
): Promise<Profile> {
  const row: Partial<ProfileRow> & { updated_at: string } = { updated_at: new Date().toISOString() }
  if (patch.displayName !== undefined) row.display_name = patch.displayName
  if (patch.weightUnit) row.weight_unit = patch.weightUnit
  if (patch.energyUnit) row.energy_unit = patch.energyUnit
  if (patch.heightCm !== undefined) row.height_cm = patch.heightCm == null ? null : Math.round(patch.heightCm * 10) / 10
  if (patch.birthYear !== undefined) row.birth_year = patch.birthYear
  if (patch.sex !== undefined) row.sex = patch.sex
  if (patch.dailyActivity !== undefined) row.daily_activity = patch.dailyActivity
  if (patch.workoutEffort) row.workout_effort = patch.workoutEffort
  return toProfile(
    unwrap<ProfileRow>(await db.from('profiles').update(row).eq('id', userId).select('*').single()),
  )
}

/**
 * Permanently delete the signed-in user's account and every row they own.
 * Can't be undone. Sign out locally afterwards: the session is no longer valid.
 */
export async function deleteMyAccount(db: Client): Promise<void> {
  unwrap(await db.rpc('delete_my_account'))
}
