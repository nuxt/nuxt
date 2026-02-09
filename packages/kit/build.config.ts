import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: 'src/index',
      dts: { oxc: true },
      rolldown: {
        external: [
          '@rspack/core',
          '@nuxt/schema',
          'nitro',
          'nitropack',
          'webpack',
          'vite',
          'h3',
          'unimport',
          /^nuxt(\/|$)/,
          /^#build\//,
          /^#internal\//,
        ],
      },
    },
  ],
})
