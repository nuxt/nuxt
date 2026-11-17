import { readFileSync } from 'node:fs'
import os from 'node:os'
import process from 'node:process'

interface Environment {
  node: string
  os: string
  cpu: string
  cores: number
  memory: string
  loadAverage: string
  date: string
}

export function environment (): Environment {
  const cpus = os.cpus()
  return {
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    cpu: cpus[0]?.model || cpuFromProc() || 'unknown',
    cores: cpus.length,
    memory: `${(os.totalmem() / 1024 ** 3).toFixed(1)} GB`,
    loadAverage: os.loadavg().map(n => n.toFixed(2)).join(', '),
    date: new Date().toISOString(),
  }
}

function cpuFromProc (): string | undefined {
  try {
    const line = readFileSync('/proc/cpuinfo', 'utf8').split('\n').find(l => /^(?:model name|Model|Hardware)\s*:/.test(l))
    return line?.split(':')[1]?.trim()
  } catch {
    return undefined
  }
}
