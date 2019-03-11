/**
 * NuxtConfigurationServerMiddleware
 * Documentation: https://nuxtjs.org/api/configuration-servermiddleware
 */

import { RequestHandler } from 'express'

export type NuxtConfigurationServerMiddleware = string | { path: string, handler: string | Function } | RequestHandler
