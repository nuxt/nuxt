import { Buffer } from 'node:buffer'
import process from 'node:process'

globalThis.Buffer = globalThis.Buffer || Buffer
globalThis.process = globalThis.process || process
