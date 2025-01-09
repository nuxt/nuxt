import { loadNuxt } from "@nuxt/kit"

import nuxtA from "./nuxt-a/nuxt.config"
import nuxtB from "./nuxt-b/nuxt.config"
import { resolve } from "path"


  loadNuxt({
    cwd: resolve    ('nuxt-a'),
})
  loadNuxt({
    cwd:    resolve('nuxt-b'),
})