import { warmupState } from '../../shared/warmup-state'

export default defineEventHandler(() => ({ ...warmupState() }))
