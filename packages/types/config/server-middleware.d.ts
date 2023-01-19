/**
 * NuxtOptionsServerMiddleware
 * Documentation: https://nuxtjs.org/api/configuration-servermiddleware
 */

import type { NextHandleFunction } from 'connect'

export type ServerMiddleware = NextHandleFunction

export type NuxtOptionsServerMiddleware = string | { path: string, prefix?: boolean, handler: string | ServerMiddleware } | ServerMiddleware | Record<string, ServerMiddleware>
