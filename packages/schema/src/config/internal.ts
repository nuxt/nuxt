import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /** @private */
  _majorVersion: 3,
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
   * @type {Array<{ meta: ModuleMeta; timings?: Record<string, number | undefined>; entryPath?: string }>}
   */
  _installedModules: [],
  /** @private */
  _modules: [],
})
