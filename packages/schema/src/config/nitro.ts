/**
 * @version 3
 */
export default {
  experimentNitropack: process.env.EXPERIMENT_NITROPACK ? true : false,

  /**
   * @typedef {Awaited<ReturnType<typeof import('nitropack')['NitroConfig']>>}
  */
  nitro: {}
}
