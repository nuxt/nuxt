/*!
 * @nuxt/builder v2.15.6 (c) 2016-2021
 * Released under the MIT License
 * Repository: https://github.com/nuxt/nuxt.js
 * Website: https://nuxtjs.org
*/
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');
const chalk = require('chalk');
const chokidar = require('chokidar');
const consola = require('consola');
const fsExtra = require('fs-extra');
const Glob = require('glob');
const hash = require('hash-sum');
const pify = require('pify');
const upath = require('upath');
const lodash = require('lodash');
const utils = require('@nuxt/utils');
const vueApp = require('@nuxt/vue-app');
const webpack = require('@nuxt/webpack');
const ignore = require('ignore');
const serialize = require('serialize-javascript');
const devalue = require('@nuxt/devalue');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

const path__default = /*#__PURE__*/_interopDefaultLegacy(path);
const chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
const chokidar__default = /*#__PURE__*/_interopDefaultLegacy(chokidar);
const consola__default = /*#__PURE__*/_interopDefaultLegacy(consola);
const fsExtra__default = /*#__PURE__*/_interopDefaultLegacy(fsExtra);
const Glob__default = /*#__PURE__*/_interopDefaultLegacy(Glob);
const hash__default = /*#__PURE__*/_interopDefaultLegacy(hash);
const pify__default = /*#__PURE__*/_interopDefaultLegacy(pify);
const upath__default = /*#__PURE__*/_interopDefaultLegacy(upath);
const ignore__default = /*#__PURE__*/_interopDefaultLegacy(ignore);
const serialize__default = /*#__PURE__*/_interopDefaultLegacy(serialize);
const devalue__default = /*#__PURE__*/_interopDefaultLegacy(devalue);

class Ignore {
  constructor(options) {
    this.rootDir = options.rootDir;
    this.ignoreOptions = options.ignoreOptions;
    this.ignoreArray = options.ignoreArray;
    this.addIgnoresRules();
  }
  static get IGNORE_FILENAME() {
    return ".nuxtignore";
  }
  findIgnoreFile() {
    if (!this.ignoreFile) {
      const ignoreFile = path__default["default"].resolve(this.rootDir, Ignore.IGNORE_FILENAME);
      if (fsExtra__default["default"].existsSync(ignoreFile) && fsExtra__default["default"].statSync(ignoreFile).isFile()) {
        this.ignoreFile = ignoreFile;
        this.ignore = ignore__default["default"](this.ignoreOptions);
      }
    }
    return this.ignoreFile;
  }
  readIgnoreFile() {
    if (this.findIgnoreFile()) {
      return fsExtra__default["default"].readFileSync(this.ignoreFile, "utf8");
    }
  }
  addIgnoresRules() {
    const content = this.readIgnoreFile();
    if (content) {
      this.ignore.add(content);
    }
    if (this.ignoreArray && this.ignoreArray.length > 0) {
      if (!this.ignore) {
        this.ignore = ignore__default["default"](this.ignoreOptions);
      }
      this.ignore.add(this.ignoreArray);
    }
  }
  filter(paths) {
    if (this.ignore) {
      return this.ignore.filter([].concat(paths || []));
    }
    return paths;
  }
  reload() {
    delete this.ignore;
    delete this.ignoreFile;
    this.addIgnoresRules();
  }
}

class BuildContext {
  constructor(builder) {
    this._builder = builder;
    this.nuxt = builder.nuxt;
    this.options = builder.nuxt.options;
    this.target = builder.nuxt.options.target;
  }
  get buildOptions() {
    return this.options.build;
  }
  get plugins() {
    return this._builder.plugins;
  }
}

class TemplateContext {
  constructor(builder, options) {
    this.templateFiles = Array.from(builder.template.files);
    this.templateVars = {
      nuxtOptions: options,
      features: options.features,
      extensions: options.extensions.map((ext) => ext.replace(/^\./, "")).join("|"),
      messages: options.messages,
      splitChunks: options.build.splitChunks,
      uniqBy: lodash.uniqBy,
      isDev: options.dev,
      isTest: options.test,
      isFullStatic: utils.isFullStatic(options),
      debug: options.debug,
      buildIndicator: options.dev && options.build.indicator,
      vue: { config: options.vue.config },
      fetch: options.fetch,
      mode: options.mode,
      router: options.router,
      env: options.env,
      head: options.head,
      store: options.features.store ? options.store : false,
      globalName: options.globalName,
      globals: builder.globals,
      css: options.css,
      plugins: builder.plugins,
      appPath: "./App.js",
      layouts: Object.assign({}, options.layouts),
      loading: typeof options.loading === "string" ? builder.relativeToBuild(options.srcDir, options.loading) : options.loading,
      pageTransition: options.pageTransition,
      layoutTransition: options.layoutTransition,
      rootDir: options.rootDir,
      srcDir: options.srcDir,
      dir: options.dir,
      components: {
        ErrorPage: options.ErrorPage ? builder.relativeToBuild(options.ErrorPage) : null
      }
    };
  }
  get templateOptions() {
    let lodash = null;
    return {
      imports: {
        serialize: serialize__default["default"],
        serializeFunction: utils.serializeFunction,
        devalue: devalue__default["default"],
        hash: hash__default["default"],
        r: utils.r,
        wp: utils.wp,
        wChunk: utils.wChunk,
        _: new Proxy({}, {
          get(target, prop) {
            if (!lodash) {
              consola__default["default"].warn("Avoid using _ inside templates");
              lodash = utils.requireModule("lodash");
            }
            return lodash[prop];
          }
        })
      },
      interpolate: /<%=([\s\S]+?)%>/g
    };
  }
}

const glob = pify__default["default"](Glob__default["default"]);
class Builder {
  constructor(nuxt, bundleBuilder) {
    this.nuxt = nuxt;
    this.plugins = [];
    this.options = nuxt.options;
    this.globals = utils.determineGlobals(nuxt.options.globalName, nuxt.options.globals);
    this.watchers = {
      files: null,
      custom: null,
      restart: null
    };
    this.supportedExtensions = ["vue", "js", ...this.options.build.additionalExtensions || []];
    this.relativeToBuild = (...args) => utils.relativeTo(this.options.buildDir, ...args);
    this._buildStatus = STATUS.INITIAL;
    if (this.options.dev) {
      this.nuxt.hook("build:done", () => {
        consola__default["default"].info("Waiting for file changes");
        this.watchClient();
        this.watchRestart();
      });
      this.serverMiddlewareHMR();
      this.nuxt.hook("close", () => this.close());
    }
    if (this.options.build.analyze) {
      this.nuxt.hook("build:done", () => {
        consola__default["default"].warn(`Notice: Please do not deploy bundles built with "analyze" mode, they're for analysis purposes only.`);
      });
    }
    this.template = this.options.build.template || vueApp.template;
    if (typeof this.template === "string") {
      this.template = this.nuxt.resolver.requireModule(this.template).template;
    }
    this.bundleBuilder = this.getBundleBuilder(bundleBuilder);
    this.ignore = new Ignore({
      rootDir: this.options.srcDir,
      ignoreArray: this.options.ignore
    });
  }
  getBundleBuilder(BundleBuilder) {
    if (typeof BundleBuilder === "object") {
      return BundleBuilder;
    }
    const context = new BuildContext(this);
    if (typeof BundleBuilder !== "function") {
      BundleBuilder = webpack.BundleBuilder;
    }
    return new BundleBuilder(context);
  }
  forGenerate() {
    this.options.target = utils.TARGETS.static;
    this.bundleBuilder.forGenerate();
  }
  async build() {
    if (this._buildStatus === STATUS.BUILD_DONE && this.options.dev) {
      return this;
    }
    if (this._buildStatus === STATUS.BUILDING) {
      await utils.waitFor(1e3);
      return this.build();
    }
    this._buildStatus = STATUS.BUILDING;
    if (this.options.dev) {
      consola__default["default"].info("Preparing project for development");
      consola__default["default"].info("Initial build may take a while");
    } else {
      consola__default["default"].info("Production build");
      if (this.options.render.ssr) {
        consola__default["default"].info(`Bundling for ${chalk__default["default"].bold.yellow("server")} and ${chalk__default["default"].bold.green("client")} side`);
      } else {
        consola__default["default"].info(`Bundling only for ${chalk__default["default"].bold.green("client")} side`);
      }
      consola__default["default"].info(`Target: ${chalk__default["default"].bold.cyan(this.options.target)}`);
    }
    await this.nuxt.ready();
    await this.nuxt.callHook("build:before", this, this.options.build);
    await this.validatePages();
    consola__default["default"].success("Builder initialized");
    consola__default["default"].debug(`App root: ${this.options.srcDir}`);
    await fsExtra__default["default"].emptyDir(utils.r(this.options.buildDir));
    const buildDirs = [utils.r(this.options.buildDir, "components")];
    if (!this.options.dev) {
      buildDirs.push(utils.r(this.options.buildDir, "dist", "client"), utils.r(this.options.buildDir, "dist", "server"));
    }
    await Promise.all(buildDirs.map((dir) => fsExtra__default["default"].emptyDir(dir)));
    await this.nuxt.callHook("builder:prepared", this, this.options.build);
    await this.generateRoutesAndFiles();
    this.options.build.watch.push(this.globPathWithExtensions(this.template.dir));
    await this.resolvePlugins();
    await this.bundleBuilder.build();
    this._buildStatus = STATUS.BUILD_DONE;
    await this.nuxt.callHook("build:done", this);
    return this;
  }
  async validatePages() {
    this._nuxtPages = typeof this.options.build.createRoutes !== "function";
    if (!this._nuxtPages || await fsExtra__default["default"].exists(path__default["default"].resolve(this.options.srcDir, this.options.dir.pages))) {
      return;
    }
    const dir = this.options.srcDir;
    if (await fsExtra__default["default"].exists(path__default["default"].join(this.options.srcDir, "..", this.options.dir.pages))) {
      throw new Error(`No \`${this.options.dir.pages}\` directory found in ${dir}. Did you mean to run \`nuxt\` in the parent (\`../\`) directory?`);
    }
    this._defaultPage = true;
    consola__default["default"].warn(`No \`${this.options.dir.pages}\` directory found in ${dir}. Using the default built-in page.`);
  }
  globPathWithExtensions(path2) {
    return `${path2}/**/*.{${this.supportedExtensions.join(",")}}`;
  }
  createTemplateContext() {
    return new TemplateContext(this, this.options);
  }
  async generateRoutesAndFiles() {
    consola__default["default"].debug("Generating nuxt files");
    this.plugins = Array.from(await this.normalizePlugins());
    const templateContext = this.createTemplateContext();
    await Promise.all([
      this.resolveLayouts(templateContext),
      this.resolveRoutes(templateContext),
      this.resolveStore(templateContext),
      this.resolveMiddleware(templateContext)
    ]);
    this.addOptionalTemplates(templateContext);
    await this.resolveCustomTemplates(templateContext);
    await this.resolveLoadingIndicator(templateContext);
    await this.compileTemplates(templateContext);
    consola__default["default"].success("Nuxt files generated");
  }
  async normalizePlugins() {
    if (typeof this.options.extendPlugins === "function") {
      const extendedPlugins = this.options.extendPlugins(this.options.plugins);
      if (Array.isArray(extendedPlugins)) {
        this.options.plugins = extendedPlugins;
      }
    }
    await this.nuxt.callHook("builder:extendPlugins", this.options.plugins);
    const modes = ["client", "server"];
    const modePattern = new RegExp(`\\.(${modes.join("|")})(\\.\\w+)*$`);
    return lodash.uniqBy(this.options.plugins.map((p) => {
      if (typeof p === "string") {
        p = { src: p };
      }
      const pluginBaseName = path__default["default"].basename(p.src, path__default["default"].extname(p.src)).replace(/[^a-zA-Z?\d\s:]/g, "");
      if (p.ssr === false) {
        p.mode = "client";
      } else if (p.mode === void 0) {
        p.mode = "all";
        p.src.replace(modePattern, (_, mode) => {
          if (modes.includes(mode)) {
            p.mode = mode;
          }
        });
      } else if (!["client", "server", "all"].includes(p.mode)) {
        consola__default["default"].warn(`Invalid plugin mode (server/client/all): '${p.mode}'. Falling back to 'all'`);
        p.mode = "all";
      }
      return {
        src: this.nuxt.resolver.resolveAlias(p.src),
        mode: p.mode,
        name: "nuxt_plugin_" + pluginBaseName + "_" + hash__default["default"](p.src)
      };
    }), (p) => p.name);
  }
  addOptionalTemplates(templateContext) {
    if (this.options.build.indicator) {
      templateContext.templateFiles.push("components/nuxt-build-indicator.vue");
    }
    if (this.options.loading !== false) {
      templateContext.templateFiles.push("components/nuxt-loading.vue");
    }
  }
  async resolveFiles(dir, cwd = this.options.srcDir) {
    return this.ignore.filter(await glob(this.globPathWithExtensions(dir), {
      cwd,
      follow: this.options.build.followSymlinks
    }));
  }
  async resolveRelative(dir) {
    const dirPrefix = new RegExp(`^${dir}/`);
    return (await this.resolveFiles(dir)).map((file) => ({ src: file.replace(dirPrefix, "") }));
  }
  async resolveLayouts({ templateVars, templateFiles }) {
    if (!this.options.features.layouts) {
      return;
    }
    if (await fsExtra__default["default"].exists(path__default["default"].resolve(this.options.srcDir, this.options.dir.layouts))) {
      for (const file of await this.resolveFiles(this.options.dir.layouts)) {
        const name = file.replace(new RegExp(`^${this.options.dir.layouts}/`), "").replace(new RegExp(`\\.(${this.supportedExtensions.join("|")})$`), "");
        if (name === "error") {
          if (!templateVars.components.ErrorPage) {
            templateVars.components.ErrorPage = this.relativeToBuild(this.options.srcDir, file);
          }
        } else if (this.options.layouts[name]) {
          consola__default["default"].warn(`Duplicate layout registration, "${name}" has been registered as "${this.options.layouts[name]}"`);
        } else if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
          templateVars.layouts[name] = this.relativeToBuild(this.options.srcDir, file);
        }
      }
    }
    if (!templateVars.layouts.default) {
      await fsExtra__default["default"].mkdirp(utils.r(this.options.buildDir, "layouts"));
      templateFiles.push("layouts/default.vue");
      templateVars.layouts.default = "./layouts/default.vue";
    }
  }
  async resolveRoutes({ templateVars }) {
    consola__default["default"].debug("Generating routes...");
    const { routeNameSplitter, trailingSlash } = this.options.router;
    if (this._defaultPage) {
      templateVars.router.routes = utils.createRoutes({
        files: ["index.vue"],
        srcDir: this.template.dir + "/pages",
        routeNameSplitter,
        trailingSlash
      });
    } else if (this._nuxtPages) {
      const files = {};
      const ext = new RegExp(`\\.(${this.supportedExtensions.join("|")})$`);
      for (const page of await this.resolveFiles(this.options.dir.pages)) {
        const key = page.replace(ext, "");
        if (/\.vue$/.test(page) || !files[key]) {
          files[key] = page.replace(/(['"])/g, "\\$1");
        }
      }
      templateVars.router.routes = utils.createRoutes({
        files: Object.values(files),
        srcDir: this.options.srcDir,
        pagesDir: this.options.dir.pages,
        routeNameSplitter,
        supportedExtensions: this.supportedExtensions,
        trailingSlash
      });
    } else {
      templateVars.router.routes = await this.options.build.createRoutes(this.options.srcDir);
    }
    await this.nuxt.callHook("build:extendRoutes", templateVars.router.routes, utils.r);
    if (typeof this.options.router.extendRoutes === "function") {
      const extendedRoutes = await this.options.router.extendRoutes(templateVars.router.routes, utils.r);
      if (extendedRoutes !== void 0) {
        templateVars.router.routes = extendedRoutes;
      }
    }
    this.routes = templateVars.router.routes;
  }
  async resolveStore({ templateVars, templateFiles }) {
    if (!this.options.features.store || !this.options.store) {
      return;
    }
    templateVars.storeModules = (await this.resolveRelative(this.options.dir.store)).sort(({ src: p1 }, { src: p2 }) => {
      let res = p1.split("/").length - p2.split("/").length;
      if (res === 0 && p1.includes("/index.")) {
        res = -1;
      } else if (res === 0 && p2.includes("/index.")) {
        res = 1;
      }
      return res;
    });
    templateFiles.push("store.js");
  }
  async resolveMiddleware({ templateVars, templateFiles }) {
    if (!this.options.features.middleware) {
      return;
    }
    const middleware = await this.resolveRelative(this.options.dir.middleware);
    const extRE = new RegExp(`\\.(${this.supportedExtensions.join("|")})$`);
    templateVars.middleware = middleware.map(({ src }) => {
      const name = src.replace(extRE, "");
      const dst = this.relativeToBuild(this.options.srcDir, this.options.dir.middleware, src);
      return { name, src, dst };
    });
    templateFiles.push("middleware.js");
  }
  async resolveCustomTemplates(templateContext) {
    this.options.build.templates = this.options.build.templates.map((t) => {
      const src = t.src || t;
      return {
        src: utils.r(this.options.srcDir, src),
        dst: t.dst || path__default["default"].basename(src),
        custom: true,
        ...typeof t === "object" ? t : void 0
      };
    });
    const customTemplateFiles = this.options.build.templates.map((t) => t.dst || path__default["default"].basename(t.src || t));
    const templatePaths = lodash.uniq([
      ...customTemplateFiles,
      ...templateContext.templateFiles
    ]);
    const appDir = path__default["default"].resolve(this.options.srcDir, this.options.dir.app);
    templateContext.templateFiles = await Promise.all(templatePaths.map(async (file) => {
      const customTemplateIndex = customTemplateFiles.indexOf(file);
      const customTemplate = customTemplateIndex !== -1 ? this.options.build.templates[customTemplateIndex] : null;
      let src = customTemplate ? customTemplate.src || customTemplate : utils.r(this.template.dir, file);
      const customAppFile = path__default["default"].resolve(this.options.srcDir, this.options.dir.app, file);
      const customAppFileExists = customAppFile.startsWith(appDir) && await fsExtra__default["default"].exists(customAppFile);
      if (customAppFileExists) {
        src = customAppFile;
      }
      return {
        src,
        dst: file,
        custom: Boolean(customAppFileExists || customTemplate),
        options: customTemplate && customTemplate.options || {}
      };
    }));
  }
  async resolveLoadingIndicator({ templateFiles }) {
    if (!this.options.loadingIndicator.name) {
      return;
    }
    let indicatorPath = path__default["default"].resolve(this.template.dir, "views/loading", this.options.loadingIndicator.name + ".html");
    let customIndicator = false;
    if (!await fsExtra__default["default"].exists(indicatorPath)) {
      indicatorPath = this.nuxt.resolver.resolveAlias(this.options.loadingIndicator.name);
      if (await fsExtra__default["default"].exists(indicatorPath)) {
        customIndicator = true;
      } else {
        indicatorPath = null;
      }
    }
    if (!indicatorPath) {
      consola__default["default"].error(`Could not fetch loading indicator: ${this.options.loadingIndicator.name}`);
      return;
    }
    templateFiles.push({
      src: indicatorPath,
      dst: "loading.html",
      custom: customIndicator,
      options: this.options.loadingIndicator
    });
  }
  async compileTemplates(templateContext) {
    const { templateVars, templateFiles, templateOptions } = templateContext;
    await this.nuxt.callHook("build:templates", {
      templateVars,
      templatesFiles: templateFiles,
      resolve: utils.r
    });
    templateOptions.imports = {
      ...templateOptions.imports,
      resolvePath: this.nuxt.resolver.resolvePath,
      resolveAlias: this.nuxt.resolver.resolveAlias,
      relativeToBuild: this.relativeToBuild
    };
    await Promise.all(templateFiles.map(async (templateFile) => {
      const { src, dst, custom } = templateFile;
      if (custom) {
        this.options.build.watch.push(src);
      }
      const fileContent = await fsExtra__default["default"].readFile(src, "utf8");
      let content;
      try {
        const templateFunction = lodash.template(fileContent, templateOptions);
        content = utils.stripWhitespace(templateFunction({
          ...templateVars,
          ...templateFile
        }));
      } catch (err) {
        throw new Error(`Could not compile template ${src}: ${err.message}`);
      }
      const relativePath = utils.r(this.options.buildDir, dst);
      await fsExtra__default["default"].outputFile(relativePath, content, "utf8");
    }));
  }
  resolvePlugins() {
    return Promise.all(this.plugins.map(async (p) => {
      const ext = "{?(.+([^.])),/index.+([^.])}";
      const pluginFiles = await glob(`${p.src}${ext}`);
      if (!pluginFiles || pluginFiles.length === 0) {
        throw new Error(`Plugin not found: ${p.src}`);
      }
      if (pluginFiles.length > 1 && !utils.isIndexFileAndFolder(pluginFiles)) {
        consola__default["default"].warn({
          message: `Found ${pluginFiles.length} plugins that match the configuration, suggest to specify extension:`,
          additional: "\n" + pluginFiles.map((x) => `- ${x}`).join("\n")
        });
      }
      p.src = this.relativeToBuild(p.src);
    }));
  }
  createFileWatcher(patterns, events, listener, watcherCreatedCallback) {
    const options = this.options.watchers.chokidar;
    const watcher = chokidar__default["default"].watch(patterns, options);
    for (const event of events) {
      watcher.on(event, listener);
    }
    const { rewatchOnRawEvents } = this.options.watchers;
    if (rewatchOnRawEvents && Array.isArray(rewatchOnRawEvents)) {
      watcher.on("raw", (_event) => {
        if (rewatchOnRawEvents.includes(_event)) {
          watcher.close();
          listener();
          this.createFileWatcher(patterns, events, listener, watcherCreatedCallback);
        }
      });
    }
    if (typeof watcherCreatedCallback === "function") {
      watcherCreatedCallback(watcher);
    }
  }
  assignWatcher(key) {
    return (watcher) => {
      if (this.watchers[key]) {
        this.watchers[key].close();
      }
      this.watchers[key] = watcher;
    };
  }
  watchClient() {
    let patterns = [
      utils.r(this.options.srcDir, this.options.dir.layouts),
      utils.r(this.options.srcDir, this.options.dir.middleware)
    ];
    if (this.options.store) {
      patterns.push(utils.r(this.options.srcDir, this.options.dir.store));
    }
    if (this._nuxtPages && !this._defaultPage) {
      patterns.push(utils.r(this.options.srcDir, this.options.dir.pages));
    }
    patterns = patterns.map((path2, ...args) => upath__default["default"].normalizeSafe(this.globPathWithExtensions(path2), ...args));
    const refreshFiles = lodash.debounce(() => this.generateRoutesAndFiles(), 200);
    this.createFileWatcher(patterns, ["add", "unlink"], refreshFiles, this.assignWatcher("files"));
    const customPatterns = lodash.uniq([
      ...this.options.build.watch,
      ...Object.values(lodash.omit(this.options.build.styleResources, ["options"]))
    ]).map(this.nuxt.resolver.resolveAlias).map(upath__default["default"].normalizeSafe);
    if (customPatterns.length === 0) {
      return;
    }
    this.createFileWatcher(customPatterns, ["change"], refreshFiles, this.assignWatcher("custom"));
    this.createFileWatcher([utils.r(this.options.srcDir, this.options.dir.app)], ["add", "change", "unlink"], refreshFiles, this.assignWatcher("app"));
  }
  serverMiddlewareHMR() {
    if (!this.nuxt.server) {
      return;
    }
    const entries = this.nuxt.server.serverMiddlewarePaths();
    const deps = new Set();
    const dep2Entry = {};
    for (const entry of entries) {
      for (const dep of utils.scanRequireTree(entry)) {
        deps.add(dep);
        if (!dep2Entry[dep]) {
          dep2Entry[dep] = new Set();
        }
        dep2Entry[dep].add(entry);
      }
    }
    this.createFileWatcher(Array.from(deps), ["all"], lodash.debounce((event, fileName) => {
      if (!dep2Entry[fileName]) {
        return;
      }
      for (const entry of dep2Entry[fileName]) {
        let newItem;
        try {
          newItem = this.nuxt.server.replaceMiddleware(entry, entry);
        } catch (error) {
          consola__default["default"].error(error);
          consola__default["default"].error(`[HMR Error]: ${error}`);
        }
        if (!newItem) {
          return this.nuxt.callHook("watch:restart", { event, path: fileName });
        }
        consola__default["default"].info(`[HMR] ${chalk__default["default"].cyan(newItem.route || "/")} (${chalk__default["default"].grey(fileName)})`);
      }
      this.serverMiddlewareHMR();
    }, 200), this.assignWatcher("serverMiddleware"));
  }
  watchRestart() {
    const nuxtRestartWatch = [
      ...this.options.watch
    ].map(this.nuxt.resolver.resolveAlias);
    if (this.ignore.ignoreFile) {
      nuxtRestartWatch.push(this.ignore.ignoreFile);
    }
    if (this.options._envConfig && this.options._envConfig.dotenv) {
      nuxtRestartWatch.push(this.options._envConfig.dotenv);
    }
    if (this._nuxtPages && this._defaultPage) {
      nuxtRestartWatch.push(path__default["default"].join(this.options.srcDir, this.options.dir.pages));
    }
    if (!this.options.store) {
      nuxtRestartWatch.push(path__default["default"].join(this.options.srcDir, this.options.dir.store));
    }
    this.createFileWatcher(nuxtRestartWatch, ["all"], async (event, fileName) => {
      if (["add", "change", "unlink"].includes(event) === false) {
        return;
      }
      await this.nuxt.callHook("watch:fileChanged", this, fileName);
      await this.nuxt.callHook("watch:restart", { event, path: fileName });
    }, this.assignWatcher("restart"));
  }
  unwatch() {
    for (const watcher in this.watchers) {
      this.watchers[watcher].close();
    }
  }
  async close() {
    if (this.__closed) {
      return;
    }
    this.__closed = true;
    this.unwatch();
    if (typeof this.bundleBuilder.close === "function") {
      await this.bundleBuilder.close();
    }
  }
}
const STATUS = {
  INITIAL: 1,
  BUILD_DONE: 2,
  BUILDING: 3
};

function getBuilder(nuxt) {
  return new Builder(nuxt);
}
function build(nuxt) {
  return getBuilder(nuxt).build();
}

exports.Builder = Builder;
exports.build = build;
exports.getBuilder = getBuilder;
