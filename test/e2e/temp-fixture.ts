import { fileURLToPath } from 'node:url'
import { editFixture } from '../fixture-copy'

/** Copies under `fixtures-temp` that suites rewrite while they run, mapped to their source fixture. */
export const tempFixtures = {
  'hmr': 'hmr',
  'hmr-sibling-layer': 'hmr-sibling-layer',
  'dev-error-overlay': 'dev-error-sourcemap',
  'dev-error-recovery': 'dev-error-sourcemap',
  'dev-error-compile': 'dev-error-sourcemap',
} as const

export type TempFixture = keyof typeof tempFixtures

export function tempFixtureDir (name: TempFixture): string {
  return fileURLToPath(new URL(`../fixtures-temp/${name}`, import.meta.url))
}

/** A fixture copy under `fixtures-temp` that a suite can rewrite while it runs. */
export function useTempFixture (name: TempFixture) {
  return editFixture(tempFixtureDir(name))
}
