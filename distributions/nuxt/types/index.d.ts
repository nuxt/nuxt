import Vue from 'vue'
import { Route } from 'vue-router'
import { Dictionary } from 'vue-router/types/router';
import { Store } from 'vuex'
import { MetaInfo } from 'vue-meta'

declare module 'vue/types/options' {
  interface Context {
    app: Vue;
    isClient: boolean;
    isServer: boolean;
    isStatic: boolean;
    isDev: boolean;
    isHMR: boolean;
    route: Route;
    store: Store<any>;
    env: Object;
    params: Dictionary<string>;
    query: Dictionary<string>;
    req: Request;
    res: Response;
    redirect(status: number, path: string, query?: object): void;
    redirect(path: string, query?: object): void;
    error: Function;
    nuxtState: Object;
    beforeNuxtRender: Function;
  }
  interface Transition {
    name?: string;
    mode?: string;
    css?: boolean;
    duration?: number;
    type?: string;
    enterClass?: string;
    enterToClass?: string;
    enterActiveClass?: string;
    leaveClass?: string;
    leaveToClass?: string;
    leaveActiveClass?: string;
  }

  interface ComponentOptions<V extends Vue> {
    asyncData?: (ctx: Context) => object;
    fetch?: (ctx: Context) => Promise<void> | void;
    head?: MetaInfo | (() => MetaInfo);
    layout?: string | ((ctx: Context) => string);
    middleware?: string | string[];
    scrollToTop?: boolean;
    transition?: string | Transition | ((to: Route, from: Route) => string);
    validate?: (ctx: Context) => Promise<boolean> | boolean;
    watchQuery?: boolean | string[];
  }
}
