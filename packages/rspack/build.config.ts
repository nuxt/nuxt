import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: 'src/index',
      dts: { oxc: true },
      rolldown: {
        external: ['#builder'],
      },
    },
    { type: 'bundle', input: 'src/loaders/vue-module-identifier', dts: false },
  ],
})
