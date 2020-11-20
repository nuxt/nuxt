import nuxt2 from './module/nuxt2'

export default function () {
  const { nuxt } = this
  return nuxt2(nuxt, this)
}
