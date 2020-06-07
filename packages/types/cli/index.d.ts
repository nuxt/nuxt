import { Configuration } from '../config'

type Command = any // TBD

export interface Hooks {
  config?(config: Configuration): void
  'run:before'?(params: { argv: string [], command: Command, rootDir: string }): void
}
