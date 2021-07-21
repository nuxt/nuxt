declare module '#build/dist/server/client.manifest.mjs' {
    type ClientManifest = any // TODO: export from vue-bundle-renderer
    const clientManifest: ClientManifest
    export default clientManifest
}

declare module '#build/dist/server/server.mjs' {
    const _default: any
    export default _default
}

declare module '#nitro-renderer' {
    export const renderToString: Function
}
