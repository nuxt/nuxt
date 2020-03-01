// import session from "express-session"

const pkg = require("./package")

let port = "8000"
export default {
  /*
   ** Headers of the page
   */
  head: {
    title: pkg.name,
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { hid: "description", name: "description", content: pkg.description }
    ],
    link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }]
  },

  /*
   ** Add server middleware
   ** Nuxt.js uses `connect` module as server
   ** So most of express middleware works with nuxt.js server middleware
   */
  serverMiddleware: [
    // session middleware
    // session({
    //   secret: "super-secret-key",
    //   resave: false,
    //   saveUninitialized: false,
    //   cookie: { maxAge: 60000 }
    // }),
    // Api middleware
    // We add /api/users/* routes
    "~/api"
  ],

  /*
   ** Nuxt.js modules
   */
  buildModules: [["@nuxtjs/vuetify", { defaultAssets: { icons: "md" } }]],
  modules: [
    // Doc: https://axios.nuxtjs.org/usage
    "@nuxtjs/axios",
    "@/modules/dbconnector.js"
  ],
  server: {
    port // default: 3000
    // host: "localhost" // default: localhost
  },
  /*
   ** Axios module configuration
   */
  axios: {
    baseURL: `http://localhost:${port}`
    // See https://github.com/nuxt-community/axios-module#options
  },
  /*
   ** Build configuration
   */
  build: {
    /*
     ** You can extend webpack config here
     */
    extend(config, ctx) {
      // Run ESLint on save
      if (ctx.isDev && ctx.isClient) {
        config.module.rules.push({
          enforce: "pre",
          test: /\.(js|vue)$/,
          loader: "eslint-loader",
          exclude: /(node_modules)/
        })
      }
    }
  }
}
