import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  /** @private */
  _majorVersion: 4,
  /** @private */
  _legacyGenerate: false,
  /** @private */
  _start: false,
  /** @private */
  _build: false,
  /** @private */
  _generate: false,
  /** @private */
  _prepare: false,
  /** @private */
  _cli: false,
  /** @private */
  _requiredModules: {},
  /** @private */
  _nuxtConfigFile: undefined,
  /** @private */
  _nuxtConfigFiles: [],
  /** @private */
  appDir: '',
  /**
   * @private
   * @type {Array<{ meta: ModuleMeta; module: NuxtModule, timings?: Record<string, number | undefined>; entryPath?: string }>}
   */
  _installedModules: [],
  /** @private */
  _modules: [],
})
