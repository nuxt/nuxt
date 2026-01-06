import type * as NitroV2 from 'nitropack/types'
import type * as NitroV3 from 'nitro/types'

type isNitroV2 = 'options' extends keyof NitroV2.Nitro
  ? '___INVALID' extends keyof NitroV2.Nitro
    ? false
    : true
  : false

export type Nitro = isNitroV2 extends true ? NitroV2.Nitro : NitroV3.Nitro
export type NitroDevEventHandler = isNitroV2 extends true ? NitroV2.NitroDevEventHandler : NitroV3.NitroDevEventHandler
export type NitroEventHandler = isNitroV2 extends true ? NitroV2.NitroEventHandler : NitroV3.NitroEventHandler
export type NitroRouteConfig = isNitroV2 extends true ? NitroV2.NitroRouteConfig : NitroV3.NitroRouteConfig
export type NitroRuntimeConfig = isNitroV2 extends true ? NitroV2.NitroRuntimeConfig : NitroV3.NitroRuntimeConfig
