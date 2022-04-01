export default {
  experimentNitropack: process.env.EXPERIMENT_NITROPACK ? true : false,

  /**
   * Configuration for Nuxt Nitro.
   *
   * @typedef {Awaited<ReturnType<typeof import('nitropack')['NitroConfig']>>}
   * @version 2
   * @version 3
  */
  nitro: {}
}
