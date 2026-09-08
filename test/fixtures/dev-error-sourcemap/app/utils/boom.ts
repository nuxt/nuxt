export function useBoom (): never {
  throw new Error('boom from a composable')
}
