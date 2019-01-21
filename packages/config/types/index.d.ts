import { MetaInfo } from "vue-meta";
import { RouterOptions, Route } from "vue-router";
import { VueConstructor } from "vue";

type Dictionary<T> = { [key: string]: T };

export type NuxtConfigurationBuild = Dictionary<any>; // TBD
export type NuxtConfigurationHead = MetaInfo; // TBR (To Be Reviewed) - `vue-meta` is a dependency of @nuxt/vue-app
export type NuxtConfigurationEnv = Dictionary<string>;
export type NuxtConfigurationGenerate = Dictionary<any>; // TBD

type NuxtConfigurationCustomizableGlobalName = 'id' | 'nuxt' | 'context' | 'pluginPrefix' | 'readyCallback' | 'loadedCallback';
export type NuxtConfigurationGlobals = { [key in NuxtConfigurationCustomizableGlobalName]?: (globalName: string) => string };

export type NuxtConfigurationHooks = Dictionary<any>; // TBD
export type NuxtConfigurationLoading = Dictionary<any>; // TBD
export type NuxtConfigurationLoadingIndicator = Dictionary<any>; // TBD

export type NuxtConfigurationModule = string | [string, Dictionary<any>] | Function; // Function signature TBD (NuxtModule interface)
export type NuxtConfigurationModules = NuxtConfigurationModule[];

export type NuxtConfigurationPlugin = string | { src: string, ssr?: boolean };
export type NuxtConfigurationPlugins = NuxtConfigurationPlugin[];

export type NuxtConfigurationRender = Dictionary<any>; // TBD

export type NuxtConfigurationServerMiddleware = string | { path: string, handler: string | Function } | Function; // Function signature TBD (NuxtServerMiddleware interface)
export type NuxtConfigurationServerMiddlewares = NuxtConfigurationServerMiddleware[];

export type NuxtConfigurationVueConfiguration = VueConstructor['config']; // TBR (To Be Reviewed) - `vue` is a dependency of @nuxt/vue-app

export type NuxtConfigurationWatchers = Dictionary<any>; // TBD

export interface NuxtConfigurationRouter extends RouterOptions { // TBR (To Be Reviewed) - `vue-router` is a dependency of @nuxt/vue-app
  routeNameSplitter?: string;
  extendRoutes?: (routes: Route[], resolve: (...pathSegments: string[]) => string) => void;
  linkPrefetchedClass?: string;
  middleware?: string | string[];
  prefetchLinks?: boolean;
}

export type NuxtConfigurationServer = Dictionary<any>; // TBD

export interface NuxtConfiguration extends Dictionary<any> { // Extends `Dictionary<any>` makes any not declared property not throwing TS errors
  build?: NuxtConfigurationBuild;
  buildDir?: string;
  css?: string[];
  dev?: boolean;
  env?: NuxtConfigurationEnv;
  generate?: NuxtConfigurationGenerate;
  globalName?: string;
  globals?: NuxtConfigurationGlobals;
  head?: NuxtConfigurationHead;
  ignorePrefix?: string;
  ignore?: string[];
  layoutTransition?: any; // TBD - should be of type `Transition` already defined in @nuxt/vue-app
  loading?: NuxtConfigurationLoading | false | string;
  loadingIndicator?: NuxtConfigurationLoadingIndicator | false | string;
  mode?: 'spa' | 'universal'; // TBR (To Be Reviewed) - should be a `NuxtMode` interface which should be used in @nuxt/vue-app/types/process.d.ts as well
  modern?: 'client' | 'server' | boolean; // TBR (To Be Reviewed) - `vue-router` is a dependency of @nuxt/vue-app
  modules?: NuxtConfigurationModules;
  modulesDir?: string[];
  plugins?: NuxtConfigurationPlugins;
  render?: NuxtConfigurationRender;
  rootDir?: string;
  router?: NuxtConfigurationRouter;
  server?: NuxtConfigurationServer;
  serverMiddleware?: NuxtConfigurationServerMiddlewares;
  srcDir?: string;
  transition?: any; // TBD - should be of type `Transition` already defined in @nuxt/vue-app
  'vue.config'?: NuxtConfigurationVueConfiguration;
  watch?: string[];
  watchers?: NuxtConfigurationWatchers;
}
