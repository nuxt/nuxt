import { warmupState } from '../../shared/warmup-state'

if (import.meta.server) {
  warmupState().module = true
}

export default defineNuxtPlugin(() => {
  if (import.meta.server) {
    warmupState().plugin = true
  }
})
