import { defineBuildConfig } from 'obuild/config'

export default defineBuildConfig({
  entries: [
    { type: 'bundle', input: 'src/index', dts: { oxc: true } },
    { type: 'transform', input: 'src/runtime/', outDir: 'dist/runtime' },
  ],
})
