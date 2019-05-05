import path from 'path'
import fs from 'fs'
import defaultsDeep from 'lodash/defaultsDeep'
import defaults from 'lodash/defaults'
import pick from 'lodash/pick'
import uniq from 'lodash/uniq'
import consola from 'consola'
import { guardDir, isNonEmptyString, isPureObject, isUrl, getMainModule } from '@nuxt/utils'
import { defaultNuxtConfigFile, getDefaultNuxtConfig } from './config'

export function getNuxtConfig(_options) {
  // Prevent duplicate calls
  // options의 nomalized가 참이면
  if (_options.__normalized__) {
    return _options
  }

  // Clone options to prevent unwanted side-effects
  // 오브젝트 복사한뒤 => 새로운 객체/주소로!
  const options = Object.assign({}, _options)
  // nomalized true로
  options.__normalized__ = true

  // Normalize options
  if (options.loading === true) {
    // loading 속성이 사라짐
    delete options.loading
  }

  // 아래 조건들이 모두 참일 때(모두 다 값이 있을 때), 
  if (
    options.router &&
    options.router.middleware &&
    !Array.isArray(options.router.middleware)
  ) {
    // array로 바꿔줌
    options.router.middleware = [options.router.middleware]
  }

  // router.base의 자료형이 string이면
  if (options.router && typeof options.router.base === 'string') {
    options._routerBaseSpecified = true
  }

  // TODO: Remove for Nuxt 3
  // transition -> pageTransition
  if (typeof options.transition !== 'undefined') {
    consola.warn('`transition` property is deprecated in favor of `pageTransition` and will be removed in Nuxt 3')
    options.pageTransition = options.transition
    delete options.transition
  }

  // name 속성 아래에다가 프로퍼티 넣어줌
  if (typeof options.pageTransition === 'string') {
    options.pageTransition = { name: options.pageTransition }
  }
  // name 속성 아래에다가 프로퍼티 넣어줌
  if (typeof options.layoutTransition === 'string') {
    options.layoutTransition = { name: options.layoutTransition }
  }
  // array로 바꿔줌
  if (typeof options.extensions === 'string') {
    options.extensions = [options.extensions]
  }

  // options.globalName이 빈string인지 아닌지 검사, 
  //. globalname의 정규식 검사(알파벳인지, 문자열이 알파벳으로 시작해 한번 이상 반복되고, 알파벳으로 끝날 때)
  // , 맞으면 lowercase로 바꿔서 리턴
  options.globalName = (isNonEmptyString(options.globalName) && /^[a-zA-Z]+$/.test(options.globalName))
    ? options.globalName.toLowerCase()
    : `nuxt`

  // Resolve rootDir
  // rootDir이 Empty 스트링인지 검사, 맞으면 options의 루트디렉토리 리턴, 아니면 현재 루트 디렉토리 리턴
  options.rootDir = isNonEmptyString(options.rootDir) ? path.resolve(options.rootDir) : process.cwd()

  // Apply defaults by ${buildDir}/dist/build.config.js
  // TODO: Unsafe operation.
  // const buildDir = options.buildDir || defaults.buildDir
  // const buildConfig = resolve(options.rootDir, buildDir, 'build.config.js')
  // if (existsSync(buildConfig)) {
  //   defaultsDeep(options, require(buildConfig))
  // }

  // Apply defaults
  // default config 묶음들 가지고옴
  const nuxtConfig = getDefaultNuxtConfig()

  // 위에서 가져온 nuxtConfig.build.publicPath를 _publicPath에다가 옮김
  nuxtConfig.build._publicPath = nuxtConfig.build.publicPath

  // Fall back to default if publicPath is falsy
  // options.build는 있는데 !options.build.publicPath가 없다면(null이거나 undefined)
  if (options.build && !options.build.publicPath) {
    options.build.publicPath = undefined
  }

  // lodash 함수, options 기준으로 nuxtConfig 합치는데, 중복 시 options따름
  defaultsDeep(options, nuxtConfig)

  // Sanitize router.base, "/"로 끝나는지
  if (!/\/$/.test(options.router.base)) {
    options.router.base += '/'
  }

  // Check srcDir and generate.dir existence
  //scrDir이나 generate.dir이 nonEmptyString인지 아닌지 판단
  const hasSrcDir = isNonEmptyString(options.srcDir)
  const hasGenerateDir = isNonEmptyString(options.generate.dir)

  // Resolve srcDir
  // 만약 #109라인의 hasSrcDir이 있다면 rootDir와 srcDir의 path를 합침. 아니라면 options.rootDir 리턴
  options.srcDir = hasSrcDir
    ? path.resolve(options.rootDir, options.srcDir)
    : options.rootDir

  // Resolve buildDir
  // 아래 두 디렉토리 합침
  options.buildDir = path.resolve(options.rootDir, options.buildDir)

  // Default value for _nuxtConfigFile
  // _nuxtConfigFile이 없다면 아래 패스에서 파일 경로 가져옴(nuxt.config임)
  if (!options._nuxtConfigFile) {
    options._nuxtConfigFile = path.resolve(options.rootDir, `${defaultNuxtConfigFile}.js`)
  }

  // 만약에 _nuxtconfigeFiles가 null이거나 undefined 라면 배열에다가 _nuxtConfigFile 넣어줌
  if (!options._nuxtConfigFiles) {
    options._nuxtConfigFiles = [
      options._nuxtConfigFile
    ]
  }

  // Watch for config file changes
  // options.watch 프로퍼티에 options_nuxtConfigFiles 배열을 넣어줌
  options.watch.push(...options._nuxtConfigFiles) // concat

  // Protect rootDir against buildDir
  guardDir(options, 'rootDir', 'buildDir')

  // generated될 디렉토리가 있는지
  if (hasGenerateDir) {
    // Resolve generate.dir
    options.generate.dir = path.resolve(options.rootDir, options.generate.dir)

    // Protect rootDir against buildDir
    guardDir(options, 'rootDir', 'generate.dir')
  }

  if (hasSrcDir) {
    // Protect srcDir against buildDir
    guardDir(options, 'srcDir', 'buildDir')

    if (hasGenerateDir) {
      // Protect srcDir against generate.dir
      guardDir(options, 'srcDir', 'generate.dir')
    }
  }

  // Populate modulesDir
  // getMainModule => require.main으로 현재 모듈과 모듈의 식구들 경로 가져옴
  // rootDir와 현재 options.modulesDir의 경로를 path.resolve로 합친 다음에 getMainModules.paths에 또 합치고 
  // 중복 검사해서 options.moudulesDir에 넣는다
  // map함수는 array나 객체의 트리를 돌릴 수 있는데 화살표 함수로 넘기는 인자로 접근 가능함
  options.modulesDir = uniq(
    getMainModule().paths.concat(
      [].concat(options.modulesDir).map(dir => path.resolve(options.rootDir, dir))
    )
  )

  const mandatoryExtensions = ['js', 'mjs', 'ts']

  // 위에 정의된 mandatoryExtensions의 엘리먼트들을 filter로 접근. ext로 접근
  // options.extensions가 ext를 가지고 있지 않은 것만 return함
  // 그것들을 options.extensions와 합침
  options.extensions = mandatoryExtensions
    .filter(ext => !options.extensions.includes(ext))
    .concat(options.extensions)

  // If app.html is defined, set the template path to the user template
  // options.appTemplatePath가 undefined라면
  if (options.appTemplatePath === undefined) {
    // 다음 내용으로 appTemplatePath 추가
    options.appTemplatePath = path.resolve(options.buildDir, 'views/app.template.html')
    // 동기적으로 파일 있는지 조회해본 다음에(exsits는 deprecated됨), 있으면 두 path 합침
    // 메소드명처럼 인자로 받은 경로들을 하나로 합쳐서 문자열 형태로 path를 리턴
    if (fs.existsSync(path.join(options.srcDir, 'app.html'))) {
      options.appTemplatePath = path.join(options.srcDir, 'app.html')
    }
  } else {
    // 맨 오른쪽 부터 왼쪽으로 경로인자들을 합쳐나가고, 중간에 루트 만나면 앞에 루트들은 무시함
    options.appTemplatePath = path.resolve(options.srcDir, options.appTemplatePath)
  }

  // [] : 문자 셋
  // [^ ]: 문자 셋에서 포함되지 않는 부분
  // (): 매칭된 값을 기억
  options.build.publicPath = options.build.publicPath.replace(/([^/])$/, '$1/')
  options.build._publicPath = options.build._publicPath.replace(/([^/])$/, '$1/')

  // Ignore publicPath on dev
  if (options.dev && isUrl(options.build.publicPath)) {
    options.build.publicPath = options.build._publicPath
  }

  // If store defined, update store options to true unless explicitly disabled
  // options.store가 false가 아니고, 현재 srcDir에 store 파일이 있는지, 혹은 store디렉토리에 파일이 있느지
  // 검사해보고 있으면 options.store를 true로..!!!
  if (
    options.store !== false &&
    fs.existsSync(path.join(options.srcDir, options.dir.store)) &&
    fs.readdirSync(path.join(options.srcDir, options.dir.store))
      .find(filename => filename !== 'README.md' && filename[0] !== '.')
  ) {
    options.store = true
  }

  // SPA loadingIndicator
  if (options.loadingIndicator) {
    // Normalize loadingIndicator
    // options.loadingIndicator가 object type이 맞는지 따져보고, 아니면 name 밑에 해당 내용 넣음
    if (!isPureObject(options.loadingIndicator)) {
      options.loadingIndicator = { name: options.loadingIndicator }
    }

    // Apply defaults
    // options.loadingIndicator에 아래 Object와 options.loadingIndicator 합친거 넣어줌
    options.loadingIndicator = Object.assign(
      {
        name: 'default',
        color: (options.loading && options.loading.color) || '#D3D3D3',
        color2: '#F5F5F5',
        background: (options.manifest && options.manifest.theme_color) || 'white',
        dev: options.dev,
        loading: options.messages.loading
      },
      options.loadingIndicator
    )
  }

  // Debug errors
  // options.debug가 undefined라면 options.debug에 options.dev 넣어줌
  if (options.debug === undefined) {
    options.debug = options.dev
  }

  // Apply default hash to CSP option
  if (options.render.csp) {
    // 아래 objects들을 하나로 합치는 lodash defautls 메소드
    // 오른쪽 기준으로 똑같으면 오른쪽 오브젝트를 우선시함
    // ★ 4번: defaults vs. defaultsDeep
    options.render.csp = defaults({}, options.render.csp, {
      hashAlgorithm: 'sha256',
      allowedSources: undefined,
      policies: undefined,
      addMeta: Boolean(options._generate),
      reportOnly: options.debug
    })
  }

  // cssSourceMap
  // options.build.cssSourceMap 없으면 options.dev 넣어줌
  if (options.build.cssSourceMap === undefined) {
    options.build.cssSourceMap = options.dev
  }

  const babelConfig = options.build.babel
  // babel cacheDirectory
  if (babelConfig.cacheDirectory === undefined) {
    // options.build.babel.cacheDirectory에 options.dev 넣어줌
    babelConfig.cacheDirectory = options.dev
  }

  // TODO: remove this warn in Nuxt 3
  // babelConfig.presets가 array이면
  if (Array.isArray(babelConfig.presets)) {
    const warnPreset = (presetName) => {
      const oldPreset = '@nuxtjs/babel-preset-app'
      const newPreset = '@nuxt/babel-preset-app'
      // 만약 presetName이 oldPreset을 가지고 있으면
      if (presetName.includes(oldPreset)) {
        presetName = presetName.replace(oldPreset, newPreset)
        consola.warn('@nuxtjs/babel-preset-app has been deprecated, please use @nuxt/babel-preset-app.')
      }
      return presetName
    }
    // babelConfig.presets에 map을 할건데, presets의 자식들을 map 안의 preset으로 접근함
    babelConfig.presets = babelConfig.presets.map((preset) => {
      // preset 또한 array이면
      const hasOptions = Array.isArray(preset)
      if (hasOptions) {
        // 위의 warnPreset 메소드 통과해서 preset이름 바꾸고 warn 메세지 날림
        preset[0] = warnPreset(preset[0])
      } else if (typeof preset === 'string') {
        preset = warnPreset(preset)
      }
      return preset
    })
  }

  // Vue config
  // options.vue.config에서 vueConfig 가져와서,
  const vueConfig = options.vue.config
  // options.vue.config가 undefined 되어있다면, !options.dev 값 넣음
  if (vueConfig.silent === undefined) {
    vueConfig.silent = !options.dev
  }
  // options.vue.config가 undefined 되어있다면, options.dev 값 넣음
  if (vueConfig.performance === undefined) {
    vueConfig.performance = options.dev
  }

  // merge custom env with variables
  // process.env의 key만 가져오는데 가져올 때 'NUXT_ENV_'로 시작하는 key만 가져옴
  // 그래서 process env의 키들 중에 process.env의 'NUXT_ENV_'로 시작하는 키들의 {키:값}만 pick 함
  // ★ 5번: pick
  const eligibleEnvVariables = pick(process.env, Object.keys(process.env).filter(k => k.startsWith('NUXT_ENV_')))
  // options.env에 eligibleEnvVariables 합침
  Object.assign(options.env, eligibleEnvVariables)

  // Normalize ignore
  // options.ignore 값이 있으면 빈 어레이에 합쳐서 넣음
  options.ignore = options.ignore ? [].concat(options.ignore) : []

  // Append ignorePrefix glob to ignore
  if (typeof options.ignorePrefix === 'string') {
    // options.ignorePrefix를 options.ignore에 합쳐줌
    options.ignore.push(`**/${options.ignorePrefix}*.*`)
  }

  // Compression middleware legacy
  if (options.render.gzip) {
    consola.warn('render.gzip is deprecated and will be removed in a future version! Please switch to render.compressor')
    // options.render.compressor에 options.render.gzip 넣어줌
    options.render.compressor = options.render.gzip
    // options.render.gzip 지워버림
    delete options.render.gzip
  }

  // Apply mode preset
  // options.modes에서 options.mode의 자식 프로퍼티들 modePreset에 넣어줌
  const modePreset = options.modes[options.mode || 'universal']

  // modePreset 없으면 경고 날림
  if (!modePreset) {
    consola.warn(`Unknown mode: ${options.mode}. Falling back to universal`)
  }
  // options에 modePreset이나 options.modes.universal merge 함
  defaultsDeep(options, modePreset || options.modes.universal)

  // If no server-side rendering, add appear true transition
  // ssr 값 없고, options.pageTransition이 true이면
  if (options.render.ssr === false && options.pageTransition) {
    // options.pageTransition.apper 을 true로 바꾸어줌
    options.pageTransition.appear = true
  }

  // We assume the SPA fallback path is 404.html (for GitHub Pages, Surge, etc.)
  // fallback이 true 이면
  if (options.generate.fallback === true) {
    options.generate.fallback = '404.html'
  }

  // options.build.stats 가 none 이거나, options.build.quiet가 true 이면
  if (options.build.stats === 'none' || options.build.quiet === true) {
    options.build.stats = false
  }

  // Vendor backward compatibility with nuxt 1.x
  if (typeof options.build.vendor !== 'undefined') {
    delete options.build.vendor
    consola.warn('vendor has been deprecated due to webpack4 optimization')
  }

  // Disable CSS extraction due to incompatibility with thread-loader
  // options.build.extractCSS 이고 options.build.parallel 이 다 있으면
  if (options.build.extractCSS && options.build.parallel) {
    // options.build.parallel는 false로
    options.build.parallel = false
    consola.warn('extractCSS cannot work with parallel build due to limited work pool in thread-loader')
  }

  // build.extractCSS.allChunks has no effect
  if (typeof options.build.extractCSS.allChunks !== 'undefined') {
    consola.warn('build.extractCSS.allChunks has no effect from v2.0.0. Please use build.optimization.splitChunks settings instead.')
  }

  // Enable minimize for production builds
  // options.build.optimization.minimize가 undefined 이면
  if (options.build.optimization.minimize === undefined) {
    options.build.optimization.minimize = !options.dev
  }

  // Enable optimizeCSS only when extractCSS is enabled
  // undefined 이면
  if (options.build.optimizeCSS === undefined) {
    options.build.optimizeCSS = options.build.extractCSS ? {} : false
  }

  const { loaders } = options.build
  const vueLoader = loaders.vue
  if (vueLoader.productionMode === undefined) {
    vueLoader.productionMode = !options.dev
  }
  const styleLoaders = [
    'css', 'cssModules', 'less',
    'sass', 'scss', 'stylus', 'vueStyle'
  ]
  // styleLoaders 돌릴건데 name으로 자식들 접근
  for (const name of styleLoaders) {
    // loaders의 name으로 접근된 자식 loader
    const loader = loaders[name]
    // loader가 true이고 loader.sourceMap 이 undefined 이면
    if (loader && loader.sourceMap === undefined) {
      // 불린 값 넣음
      loader.sourceMap = Boolean(options.build.cssSourceMap)
    }
  }

  // options.build.transpile 은 배열에 [] concat 해서 넣음
  options.build.transpile = [].concat(options.build.transpile || [])

  if (options.build.quiet === true) {
    consola.level = 0
  }

  // Use runInNewContext for dev mode by default
  const { bundleRenderer } = options.render
  if (typeof bundleRenderer.runInNewContext === 'undefined') {
    bundleRenderer.runInNewContext = options.dev
  }

  // Add loading screen
  if (options.dev) {
    options.devModules.push('@nuxt/loading-screen')
  }

  return options
}
