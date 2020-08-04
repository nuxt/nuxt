export const TARGETS = {
  server: 'server',
  static: 'static'
} as const

export type Target = keyof typeof TARGETS

export const MODES = {
  universal: 'universal',
  spa: 'spa'
} as const

export type Mode = keyof typeof MODES