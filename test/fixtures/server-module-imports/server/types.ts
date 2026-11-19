import { useModuleOnlyDep as fromBarrel } from '#imports/server'

useModuleOnlyDep() satisfies 'module-only-dep'
fromBarrel() satisfies 'module-only-dep'
// @ts-expect-error typed from the module's dependency rather than as `any`
useModuleOnlyDep() satisfies number

// @ts-expect-error the project itself does not depend on the module's dependency
export type FromPackage = typeof import('module-only-dep')
