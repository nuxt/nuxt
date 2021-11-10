export interface PublicRuntimeConfig extends Record<string, any> { }
export interface PrivateRuntimeConfig extends PublicRuntimeConfig { }

type _RuntimeConfig = PublicRuntimeConfig & Partial<PrivateRuntimeConfig>
export interface RuntimeConfig extends _RuntimeConfig { }
