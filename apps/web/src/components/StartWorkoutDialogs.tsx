import type { useStartWorkout } from '../workout/useStartWorkout'
import { ConfirmModal, ErrorText } from './ui'

export function StartWorkoutDialogs({ starter }: { starter: ReturnType<typeof useStartWorkout> }) {
  return (
    <>
      <ErrorText error={starter.error} />
      <ConfirmModal
        open={starter.pendingReplace != null}
        title="Workout in progress"
        message={
          <>
            You're in the middle of <strong>{starter.activeWorkoutName}</strong>. Starting a new workout will discard it
            without saving.
          </>
        }
        confirmLabel="Discard & start"
        danger
        onClose={starter.cancelReplace}
        onConfirm={starter.confirmReplace}
      />
    </>
  )
}
