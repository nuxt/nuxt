import { $fetch } from 'ofetch'
import type { $Fetch, NitroFetchRequest } from 'nitropack'
import { baseURL } from '#build/paths.mjs'

if (!globalThis.$fetch) {
  globalThis.$fetch = $fetch.create({
    baseURL: baseURL()
  }) as $Fetch<unknown, NitroFetchRequest>
}
