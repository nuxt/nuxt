// @ts-check
import { Agent as HTTPSAgent } from 'node:https'
import { $fetch } from 'ofetch'

export const viteNodeOptions = JSON.parse(process.env.NUXT_VITE_NODE_OPTIONS || '{}')

export const viteNodeFetch = $fetch.create({
  baseURL: viteNodeOptions.baseURL,
  // @ts-expect-error https://github.com/node-fetch/node-fetch#custom-agent
  agent: viteNodeOptions.baseURL.startsWith('https://')
    ? new HTTPSAgent({ rejectUnauthorized: false })
    : null
})
