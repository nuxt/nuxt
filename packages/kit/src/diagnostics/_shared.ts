import { createConsoleReporter } from 'nostics'
import type { DiagnosticReporter } from 'nostics'

/**
 * Shared configuration for every build-time diagnostics catalog.
 *
 * Catalogs are split by domain (one file per `B<N>xxx` range) and imported
 * directly where they are used — there is intentionally no barrel re-exporting
 * them all, so a consumer only pulls in the codes it references.
 *
 * Codes are stable, fully-qualified `NUXT_B<NNNN>` identifiers. Codes that have
 * a dedicated docs page resolve a `see:` URL via {@link docsBase}; codes whose
 * inline why+fix is self-sufficient opt out with `docs: false` rather than ship
 * a link to a page that does not exist.
 */
export function docsBase (code: string): string {
  return `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`
}

export const reporters: DiagnosticReporter[] = [/* #__PURE__ */ createConsoleReporter()]
