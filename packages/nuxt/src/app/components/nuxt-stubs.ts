import { createError } from '../composables/error'

function renderStubMessage (name: string): never {
  throw createError({
    fatal: true,
    status: 500,
    statusText: `${name} is provided by @nuxt/image. Check your console to install it or run 'npx nuxt module add @nuxt/image'`,
  })
}

export const NuxtImg: { setup: () => never } = {
  setup: (): never => renderStubMessage('<NuxtImg>'),
}

export const NuxtPicture: { setup: () => never } = {
  setup: (): never => renderStubMessage('<NuxtPicture>'),
}
