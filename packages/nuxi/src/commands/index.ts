import type { Argv } from 'mri'

export const commands = {
  dev: () => import('./dev'),
  build: () => import('./build'),
  prepare: () => import('./prepare'),
  usage: () => import('./usage'),
  info: () => import('./info')
}

export type Command = keyof typeof commands

export interface NuxtCommandMeta {
  name: string;
  usage: string;
  description: string;
  [key: string]: any;
}

export interface NuxtCommand {
  invoke(args: Argv): Promise<void> | void
  meta: NuxtCommandMeta
}

export function defineNuxtCommand (command: NuxtCommand): NuxtCommand {
  return command
}
