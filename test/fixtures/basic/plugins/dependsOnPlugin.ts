

export default defineNuxtPlugin({
    name: 'depends-on-plugin',
    dependsOn: ['async-plugin'],
    setup: async (nuxtApp) => {

        const config = useRuntimeConfig()
        await new Promise(resolve => setTimeout(resolve, 100))
       
    },
    parallel: true
})