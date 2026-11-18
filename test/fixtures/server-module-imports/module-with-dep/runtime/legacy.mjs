import { defineHandler } from 'nitro/h3'
import { useModuleOnlyDep } from '#imports'

export default defineHandler(() => ({ legacy: useModuleOnlyDep() }))
