/**
 * NuxtConfigurationServerMiddleware
 * Documentation: https://nuxtjs.org/api/configuration-servermiddleware
 */

export type NuxtConfigurationServerMiddleware = string | { path: string, handler: string | Function } | Function; // Function signature TBD (NuxtServerMiddleware interface)
