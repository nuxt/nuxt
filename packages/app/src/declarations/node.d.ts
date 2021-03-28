declare module NodeJS {
    interface Process {
        browser: boolean
        client: boolean
        mode: 'spa' | 'universal'
        modern: boolean
        server: boolean
        static: boolean
    }
}
