import { defaultUserConfig } from './utils/app-config-value'

export default defineAppConfig({
  userConfig: defaultUserConfig,
  nested: {
    val: 2,
  },
})
