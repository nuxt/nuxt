import { defineHandler } from 'nitro/h3'
import { useModuleOnlyDep as fromBarrel } from '#imports/server'

export default defineHandler(() => ({ injected: useModuleOnlyDep(), barrel: fromBarrel() }))
