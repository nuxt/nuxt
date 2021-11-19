import { ConfigSchema } from '../../schema/config'

export interface NuxtOptions extends ConfigSchema { }

type DeepPartial<T> = T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> | T[P] } : T

export interface NuxtConfig extends DeepPartial<ConfigSchema> { }
