import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  generate: {
    /**
     * The routes to generate.
     *
     * If you are using the crawler, this will be only the starting point for route generation.
     * This is often necessary when using dynamic routes.
     *
     * It can be an array or a function.
     *
     * @example
     * ```js
     * routes: ['/users/1', '/users/2', '/users/3']
     * ```
     *
     * You can pass a function that returns a promise or a function that takes a callback. It should
     * return an array of strings or objects with `route` and (optional) `payload` keys.
     *
     * @example
     * ```js
     * export default {
     *   generate: {
     *     async routes() {
     *       const res = await axios.get('https://my-api/users')
     *       return res.data.map(user => ({ route: '/users/' + user.id, payload: user }))
     *     }
     *   }
     * }
     * ```
     * Or instead:
     * ```js
     * export default {
     *   generate: {
     *     routes(callback) {
     *       axios
     *         .get('https://my-api/users')
     *         .then(res => {
     *           const routes = res.data.map(user => '/users/' + user.id)
     *           callback(null, routes)
     *         })
     *         .catch(callback)
     *     }
     *   }
     * }
     * ```
     *
     * If `routes()` returns a payload, it can be accessed from the Nuxt context.
     * @example
     * ```js
     * export default {
     *   async useAsyncData ({ params, error, payload }) {
     *     if (payload) return { user: payload }
     *     else return { user: await backend.fetchUser(params.id) }
     *   }
     * }
     * ```
     */
    routes: [],

    /**
     * An array of string or regular expressions that will prevent generation
     * of routes matching them. The routes will still be accessible when `fallback` is set.
     */
    exclude: []
  }
})
