// Cardio activities and their MET values, all from the 2024 Adult Compendium of
// Physical Activities (Herrmann et al., 2024). Each value keeps its Compendium code
// so the app can show exactly which row an estimate used.
//
// When a run, walk or outdoor ride has a distance, the average speed picks the
// Compendium row for that speed. Otherwise the effort the user chose picks a row.

import type { CardioActivity, CardioEffort, CardioMetInput } from '../types'

export interface CompendiumRow {
  code: string
  met: number
  /** As worded in the Compendium */
  description: string
}

/** A speed-specific row; `kmh` is the speed the row describes (the middle of its range). */
export interface SpeedRow extends CompendiumRow {
  kmh: number
}

const MPH = 1.609344

const speedRow = (code: string, mph: number, met: number, description: string): SpeedRow => ({
  code,
  kmh: mph * MPH,
  met,
  description,
})

/** Level running, Compendium major heading 12 (Running). */
const RUN_SPEEDS: SpeedRow[] = [
  speedRow('12028', 4.1, 6.5, 'Running, 4 to 4.2 mph (13 min/mile)'),
  speedRow('12029', 4.55, 7.8, 'Running 4.3 to 4.8 mph'),
  speedRow('12030', 5.1, 8.5, 'Running, 5.0 to 5.2 mph (12 min/mile)'),
  speedRow('12045', 5.65, 9.0, 'Running, 5.5-5.8 mph'),
  speedRow('12050', 6.15, 9.3, 'Running, 6-6.3 mph (10 min/mile)'),
  speedRow('12060', 6.7, 10.5, 'Running, 6.7 mph (9 min/mile)'),
  speedRow('12070', 7, 11.0, 'Running, 7 mph (8.5 min/mile)'),
  speedRow('12080', 7.5, 11.8, 'Running, 7.5 mph (8 min/mile)'),
  speedRow('12090', 8, 12.0, 'Running, 8 mph (7.5 min/mile)'),
  speedRow('12100', 8.6, 12.5, 'Running, 8.6 mph (7 min/mile)'),
  speedRow('12110', 9, 13.0, 'Running, 9 mph (6.5 min/mile)'),
  speedRow('12115', 9.45, 14.8, 'Running, 9.3 to 9.6 mph'),
  speedRow('12120', 10, 14.8, 'Running, 10 mph (6 min/mile)'),
  speedRow('12130', 11, 16.8, 'Running, 11 mph (5.5 min/mile)'),
  speedRow('12132', 12, 18.5, 'Running, 12 mph (5.0 min/mile)'),
  speedRow('12134', 13, 19.8, 'Running, 13 mph (4.6 min/mile)'),
  speedRow('12135', 14, 23.0, 'Running, 14 mph (4.3 min/mile)'),
]

/** Level walking on a firm surface, Compendium major heading 17 (Walking). */
const WALK_SPEEDS: SpeedRow[] = [
  speedRow('17151', 1.7, 2.3, 'Walking, less than 2.0 mph, level, strolling, very slow'),
  speedRow('17152', 2.2, 2.8, 'Walking, 2.0 to 2.4 mph, level, slow pace, firm surface'),
  speedRow('17170', 2.5, 3.0, 'Walking, 2.5 mph, firm, level surface'),
  speedRow('17190', 3.1, 3.8, 'Walking, 2.8 to 3.4 mph, level, moderate pace, firm surface'),
  speedRow('17200', 3.7, 4.8, 'Walking, 3.5 to 3.9 mph, level, brisk, firm surface, walking for exercise'),
  speedRow('17220', 4.2, 5.5, 'Walking, 4.0 to 4.4 mph (6.4 to 7.1 km/h), level, firm surface, very brisk pace'),
  speedRow('17230', 4.7, 7.0, 'Walking, 4.5 to 4.9 mph, level, firm surface, very, very brisk'),
  speedRow('17231', 5.25, 8.5, 'Walking, 5.0 to 5.5 mph (8.8 to 8.9 km/h), level, firm surface'),
]

/** Road cycling by speed, Compendium major heading 01 (Bicycling). */
const CYCLE_SPEEDS: SpeedRow[] = [
  speedRow('01018', 5.5, 3.5, 'Bicycling, leisure 5.5 mph'),
  speedRow('01019', 9.4, 5.8, 'Bicycling, leisure, 9.4 mph'),
  speedRow('01020', 10.95, 6.8, 'Bicycling, 10-11.9 mph, leisure, slow, light effort'),
  speedRow('01030', 12.95, 8.0, 'Bicycling, 12-13.9 mph, leisure, moderate effort'),
  speedRow('01040', 14.95, 10.0, 'Bicycling, 14-15.9 mph, racing or leisure, fast, vigorous effort'),
  speedRow('01050', 17.5, 12.0, 'Bicycling, 16-19 mph, racing/not drafting or >19 mph drafting, very fast, racing general'),
  speedRow('01060', 20, 16.8, 'Bicycling, >20 mph, racing, not drafting'),
]

export interface EffortOption extends CompendiumRow {
  effort: CardioEffort
  /** Shown to the user, e.g. "Easy jog" */
  label: string
}

const opt = (effort: CardioEffort, label: string, code: string, met: number, description: string): EffortOption => ({
  effort,
  label,
  code,
  met,
  description,
})

export interface CardioActivityInfo {
  activity: CardioActivity
  label: string
  /** Speed rows, when the Compendium lists this activity by speed */
  speeds: SpeedRow[] | null
  /** Whether a distance makes sense to log (some activities only store it for the user's records) */
  hasDistance: boolean
  /** Rows to pick from by how hard it felt; empty for 'other', where the user enters a MET */
  efforts: EffortOption[]
}

export const CARDIO_ACTIVITIES: Record<CardioActivity, CardioActivityInfo> = {
  run: {
    activity: 'run',
    label: 'Run',
    speeds: RUN_SPEEDS,
    hasDistance: true,
    efforts: [
      opt('light', 'Easy jog', '12020', 7.5, 'Jogging, general, self-selected pace'),
      opt('moderate', 'Steady run', '12145', 10.5, 'Running, self-selected pace'),
    ],
  },
  walk: {
    activity: 'walk',
    label: 'Walk',
    speeds: WALK_SPEEDS,
    hasDistance: true,
    efforts: [
      opt('light', 'Leisurely', '17160', 3.5, 'Walking for pleasure (Taylor Code 010)'),
      opt('moderate', 'Brisk', '17200', 4.8, 'Walking, 3.5 to 3.9 mph, level, brisk, firm surface, walking for exercise'),
    ],
  },
  hike: {
    activity: 'hike',
    label: 'Hike',
    speeds: null,
    hasDistance: true,
    efforts: [
      opt('light', 'Slow, gentle hills', '17081', 3.8, 'Hiking slowly or ambling through fields and hillsides, no load'),
      opt('moderate', 'Normal pace', '17082', 5.3, 'Hiking or walking at a normal pace through fields and hillsides, no load'),
      opt('vigorous', 'With a daypack', '17012', 7.8, 'Backpacking, hiking with a daypack, organized walking with daypack'),
    ],
  },
  cycle: {
    activity: 'cycle',
    label: 'Ride (outdoor)',
    speeds: CYCLE_SPEEDS,
    hasDistance: true,
    efforts: [
      opt('light', 'Easy', '01015', 4.3, 'Bicycling, self-selected easy pace'),
      opt('moderate', 'Moderate', '01016', 7.0, 'Bicycling, self-selected moderate pace'),
      opt('vigorous', 'Hard', '01017', 9.0, 'Bicycling, self-selected vigorous pace'),
    ],
  },
  indoor_cycle: {
    activity: 'indoor_cycle',
    label: 'Exercise bike',
    speeds: null,
    hasDistance: false,
    efforts: [
      opt('light', 'Light', '01214', 4.0, 'Bicycling, stationary, 50 watts, light effort'),
      opt('moderate', 'Moderate', '01200', 6.8, 'Bicycling, stationary, general'),
      opt('vigorous', 'Hard, e.g. a spin class', '01270', 9.0, 'Bicycling, stationary, RPM/Spin bike class'),
    ],
  },
  row: {
    activity: 'row',
    label: 'Rowing machine',
    speeds: null,
    hasDistance: true,
    efforts: [
      opt('moderate', 'Moderate', '02071', 5.0, 'Rowing, stationary ergometer, general, <100 watts, moderate effort'),
      opt('vigorous', 'Hard', '02070', 7.3, 'Rowing, stationary ergometer, general, vigorous effort'),
    ],
  },
  elliptical: {
    activity: 'elliptical',
    label: 'Elliptical',
    speeds: null,
    hasDistance: false,
    efforts: [
      opt('moderate', 'Moderate', '02048', 5.0, 'Elliptical trainer, moderate effort'),
      opt('vigorous', 'Hard', '02049', 9.0, 'Elliptical trainer, vigorous effort'),
    ],
  },
  stairs: {
    activity: 'stairs',
    label: 'Stair climber',
    speeds: null,
    hasDistance: false,
    efforts: [opt('moderate', 'General', '02065', 9.3, 'Stair treadmill ergometer, general')],
  },
  swim: {
    activity: 'swim',
    label: 'Swim',
    speeds: null,
    hasDistance: true,
    efforts: [
      opt('light', 'Slow laps', '18240', 5.8, 'Swimming laps, freestyle, slow, recreational'),
      opt('moderate', 'Steady laps', '18290', 8.0, 'Swimming, crawl, medium speed, ~50 yards/minute, vigorous effort'),
      opt('vigorous', 'Fast laps', '18230', 9.8, 'Swimming laps, freestyle, fast, vigorous effort'),
    ],
  },
  hiit: {
    activity: 'hiit',
    label: 'HIIT',
    speeds: null,
    hasDistance: false,
    efforts: [
      opt('moderate', 'Moderate', '02210', 7.0, 'High intensity interval exercise, moderate effort'),
      opt('vigorous', 'Hard, e.g. Tabata', '02214', 11.0, 'High intensity interval exercise, burpees, mountain climbers, squat jumps, Tabata, vigorous effort'),
    ],
  },
  other: {
    activity: 'other',
    label: 'Other',
    speeds: null,
    hasDistance: true,
    efforts: [],
  },
}

export const CARDIO_ACTIVITY_ORDER: CardioActivity[] = [
  'run',
  'walk',
  'cycle',
  'indoor_cycle',
  'swim',
  'row',
  'elliptical',
  'stairs',
  'hike',
  'hiit',
  'other',
]

/** Where to look up a MET value for an activity that isn't listed. */
export const COMPENDIUM_URL = 'https://pacompendium.com/'

/** Average speed in km/h, or null without a distance. */
export function averageSpeedKmh(s: Pick<CardioMetInput, 'durationS' | 'distanceM'>): number | null {
  if (s.distanceM == null || !(s.durationS > 0)) return null
  return s.distanceM / 1000 / (s.durationS / 3600)
}

/** The row whose speed is closest to `kmh`. Rows are sorted by speed. */
export function nearestSpeedRow(rows: SpeedRow[], kmh: number): SpeedRow {
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.kmh - kmh) < Math.abs(best.kmh - kmh)) best = r
  return best
}

/**
 * - speed: picked from the Compendium rows by average speed
 * - effort: picked from the Compendium rows by how hard it felt
 * - custom: a MET value the user entered for an unlisted activity
 */
export type CardioMetSource =
  | { kind: 'speed'; row: SpeedRow; speedKmh: number }
  | { kind: 'effort'; row: EffortOption; defaulted: boolean }
  | { kind: 'custom' }

export interface CardioMet {
  met: number
  source: CardioMetSource
}

/**
 * The MET value used for a piece of cardio, or null for an 'other' exercise without one.
 * Speed (from distance and time) wins when the activity has speed rows; otherwise
 * the chosen effort, falling back to the middle option if none was chosen.
 */
export function cardioMet(s: CardioMetInput): CardioMet | null {
  const info = CARDIO_ACTIVITIES[s.activity]
  if (s.activity === 'other') return s.met != null && s.met > 0 ? { met: s.met, source: { kind: 'custom' } } : null
  const speed = averageSpeedKmh(s)
  if (info.speeds && speed != null) {
    const row = nearestSpeedRow(info.speeds, speed)
    return { met: row.met, source: { kind: 'speed', row, speedKmh: speed } }
  }
  const chosen = info.efforts.find((e) => e.effort === s.effort)
  const row = chosen ?? info.efforts.find((e) => e.effort === 'moderate') ?? info.efforts[0]
  return { met: row.met, source: { kind: 'effort', row, defaulted: !chosen } }
}
