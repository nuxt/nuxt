import { defaultUserConfig } from './utils/app-config-value'

export default defineAppConfig({
  userConfig: defaultUserConfig,
  nested: {
    val: 2,
  },
  themed: {
    colors: { primary: 'green' },
    variants: ['solid'],
    format: (value: string) => value,
  },
})
