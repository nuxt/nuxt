import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['src/index', 'src/builder-env'],
      dts: { oxc: true },
      rolldown: {
        external: [
          'nuxt/app',
          '#app',
          '#build',
          '#internal',
        ],
      },
    },
  ],
})
