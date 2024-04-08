import { defineNuxtPlugin } from "#app/nuxt";
import { prerenderRoutes } from "#app/composables/ssr";
// @ts-expect-error virtual file
import _routes from "#build/routes";
// @ts-expect-error virtual file
import routerOptions from "#build/router.options";
import type { RouterConfig } from "@nuxt/schema";
import { joinURL } from "ufo";

const OPTIONAL_PARAM_RE = /^\/?:.*(\?|\(\.\*\)\*)$/;

export default defineNuxtPlugin(() => {
  if (!import.meta.server || !import.meta.prerender) {
    return;
  }
  const routes = routerOptions.routes?.(_routes) ?? _routes;
  const routesToPrerender = new Set<string>();
  const processRoutes = (
    routes: ReturnType<NonNullable<RouterConfig["routes"]>>,
    currentPath = "/"
  ) => {
    for (const route of routes) {
      // Add root of optional dynamic paths and catchalls
      if (OPTIONAL_PARAM_RE.test(route.path) && !route.children?.length) {
        routesToPrerender.add(currentPath);
      }
      // Skip dynamic paths
      if (route.path.includes(":")) {
        continue;
      }
      const fullPath = joinURL(currentPath, route.path);
      routesToPrerender.add(fullPath);
      if (route.children) {
        processRoutes(route.children, fullPath);
      }
    }
  };
  processRoutes(routes);
  prerenderRoutes(Array.from(routesToPrerender));
});
