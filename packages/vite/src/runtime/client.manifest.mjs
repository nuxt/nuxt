import { $fetch } from 'ohmyfetch'
import { getViteNodeOptions } from './vite-node-shared.mjs'

const viteNodeOptions = getViteNodeOptions()

export default () => $fetch('/manifest', { baseURL: viteNodeOptions.baseURL })
