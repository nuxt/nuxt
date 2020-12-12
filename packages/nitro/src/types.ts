import type { $Fetch } from 'ohmyfetch'

declare global {
  const $fetch: $Fetch

  namespace NodeJS {
    interface Global {
      $fetch: $Fetch
    }
  }
}
