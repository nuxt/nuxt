export default defineNuxtPlugin((nuxtApp) => {
  if (useRoute().path === '/plugins/ordering') {
    if (!nuxtApp.$layerPluginPre) {
      throw createError('layer plugin failed to run before end project plugin')
    }
    if (!nuxtApp.$layerPluginPost) {
      throw createError('layer plugin failed to run before end project plugin')
    }
  }
})
