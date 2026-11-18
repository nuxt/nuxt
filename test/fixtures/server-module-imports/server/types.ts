import { useModuleOnlyDep as fromBarrel } from '#imports/server'

useModuleOnlyDep() satisfies 'module-only-dep'
fromBarrel() satisfies 'module-only-dep'
// @ts-expect-error typed from the module's dependency rather than as `any`
useModuleOnlyDep() satisfies number
