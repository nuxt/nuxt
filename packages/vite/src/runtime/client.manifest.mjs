import { $fetch } from 'ohmyfetch'
import { getViteNodeOptions } from './vite-node-shared.mjs'

const viteNodeOptions = getViteNodeOptions()

const manifest = await $fetch('/manifest', { baseURL: viteNodeOptions.baseURL })

export default manifest
