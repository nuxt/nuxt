export default defineNuxtConfig({
devtools: true,
experimental: {
    componentIslands: {
        selectiveClient: true
    }
}
})
