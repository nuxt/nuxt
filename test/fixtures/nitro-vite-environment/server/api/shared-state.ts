import { defineEventHandler } from 'nuxt/server'
import { state } from '#shared/state'

export default defineEventHandler(() => {
  state.nitroSeen += 1
  const sawSsr = state.marks.has('ssr')
  state.marks.add('nitro')

  return {
    sawSsr,
    ssrSeen: state.ssrSeen,
    nitroSeen: state.nitroSeen,
    marks: [...state.marks].sort(),
  }
})
