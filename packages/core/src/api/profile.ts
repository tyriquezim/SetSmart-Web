import type { Profile } from '../types'
import { unwrap, type Client } from './client'

interface ProfileRow {
  id: string
  display_name: string | null
  weight_unit: Profile['weightUnit']
  energy_unit: Profile['energyUnit']
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  weightUnit: r.weight_unit,
  energyUnit: r.energy_unit,
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
  return toProfile(
    unwrap<ProfileRow>(await db.from('profiles').update(row).eq('id', userId).select('*').single()),
  )
}
