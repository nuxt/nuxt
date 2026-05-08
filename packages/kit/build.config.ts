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
          'nitro/types',
          'nitropack/types',
          'webpack',
          'vite',
          'unimport',
          /^nuxt(\/|$)/,
          /^#build\//,
          /^#internal\//,
        ],
      },
    },
  ],
})
