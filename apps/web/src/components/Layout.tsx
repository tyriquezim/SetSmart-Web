import { currentSet } from '@gymbro/core'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useActiveWorkout } from '../workout/context'
import { DumbbellIcon, HistoryIcon, HomeIcon, PlayIcon, RoutineIcon, SettingsIcon } from './icons'

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/routines', label: 'Routines', icon: RoutineIcon },
  { to: '/exercises', label: 'Exercises', icon: DumbbellIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function ActiveWorkoutBanner() {
  const { workout } = useActiveWorkout()
  const { pathname } = useLocation()
  if (!workout || pathname === '/workout') return null
  const cur = currentSet(workout)
  const status =
    workout.phase.kind === 'complete'
      ? 'Finished — tap to save'
      : workout.phase.kind === 'rest'
        ? `Resting · next: ${cur?.exercise.name ?? ''}`
        : cur
          ? `${cur.exercise.name} · Set ${cur.setNumber}/${cur.totalSets}`
          : ''
  return (
    <Link
      to="/workout"
      className="flex items-center gap-3 rounded-2xl bg-accent text-zinc-950 px-4 py-3 shadow-lg shadow-black/40"
    >
      <PlayIcon className="size-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold truncate">{workout.name}</p>
        <p className="text-xs truncate opacity-80">{status}</p>
      </div>
      <span className="ml-auto text-sm font-semibold">Resume</span>
    </Link>
  )
}

export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:border-r md:border-zinc-800/80 md:p-4 md:sticky md:top-0 md:h-dvh">
        <Link to="/" className="flex items-center gap-2 px-2 py-3 mb-4">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-xl font-black tracking-tight">GymBro</span>
        </Link>
        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-zinc-800 text-accent' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 pt-safe">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-40 md:pb-16">
          <Outlet />
        </div>
      </main>

      {/* Bottom bar (mobile) + active workout banner */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:left-56 pointer-events-none">
        <div className="mx-auto max-w-3xl px-3 pb-2 pointer-events-auto">
          <ActiveWorkoutBanner />
        </div>
        <nav className="md:hidden pointer-events-auto bg-zinc-950/95 backdrop-blur border-t border-zinc-800/80 pb-safe">
          <div className="grid grid-cols-5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 pt-2.5 text-[11px] font-medium ${
                    isActive ? 'text-accent' : 'text-zinc-500'
                  }`
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
