import { createError } from '../composables/error'

function renderStubMessage (name: string) {
  throw createError({
    fatal: true,
    statusCode: 500,
    statusMessage: `${name} is provided by @nuxt/image. Check your console to install it or run 'npx nuxi@latest module add @nuxt/image'`
  })
}

export const NuxtImg = {
  setup: () => renderStubMessage('<NuxtImg>')
}

export const NuxtPicture = {
  setup: () => renderStubMessage('<NuxtPicture>')
}
