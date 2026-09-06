/**
 * The declarations of the default server builder, pulled in when this package's own
 * declarations are emitted: the virtual modules the server runtime generates
 * (`#internal/nuxt/paths`, ...) and the config keys it contributes to `@nuxt/schema` are
 * declared there, and Nuxt's sources are compiled against them.
 *
 * This is a build-time resolution crutch only: nothing in `src/app` depends on the shapes it
 * declares, and a project configured with another `server.builder` resolves that builder's
 * declarations instead.
 */
/// <reference path="../../nitro-server/src/augments.ts" />

export {}
