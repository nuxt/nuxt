import Vue from "vue";
import { Route } from "vue-router";
import { Dictionary } from "vue-router/types/router";
import { Store } from "vuex";

// augment typings of Vue.js
import "./vue";

export interface Context {
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
  error(params: Error): void;
  nuxtState: Object;
  beforeNuxtRender: Function; //TODO: Provide better type definition
}

export interface Transition {
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

export interface Error {
  statusCode: number;
  message : string;
}
