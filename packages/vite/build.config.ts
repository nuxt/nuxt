import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    {
      type: 'bundle',
      input: ['src/index', 'src/vite-node', 'src/vite-node-entry', 'src/vite-node-runner'],
      dts: { oxc: true },
      rolldown: {
        external: ['#vite-node'],
      },
    },
  ],
})
