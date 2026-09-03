# Security Policy

## Reporting a Vulnerability

To report a vulnerability, please [privately report it via the Security tab](https://github.com/nuxt/nuxt/security/advisories/new) on the correct GitHub repository (see [documentation](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability#privately-reporting-a-security-vulnerability)). If that is impossible, feel free to send an email to **security@nuxtjs.org** instead.

All security vulnerabilities will be promptly verified and addressed.

While the discovery of new vulnerabilities is rare, we also recommend always using the latest versions of Nuxt and other dependencies by maintaining lock files (`yarn.lock`, `package-lock.json`, `pnpm-lock.yaml`, and `bun.lock`) in order to ensure your application remains as secure as possible.

## Scope

Nuxt is built on top of other projects, each with their own security process:

- [Nitro](https://github.com/nitrojs/nitro) - the server engine
- [h3](https://github.com/h3js/h3) - the HTTP framework Nitro is built on
- [Vue](https://github.com/vuejs/core) and [vue-router](https://github.com/vuejs/router) - see the [Vue security policy](https://vuejs.org/guide/best-practices/security.html#reporting-vulnerabilities)
- [unhead](https://github.com/unjs/unhead) - head/meta management
- [Vite](https://github.com/vitejs/vite) and other build tooling

If the vulnerability is clearly in one of these projects, please report it there directly. If you're not sure where the boundary lies, please feel free to report it to Nuxt; we work closely with these teams and will triage and forward it. A wrong guess is fine.

**Integration bugs are in scope for Nuxt even when the code lives elsewhere.** Nuxt composes these layers, and mismatches between them can have security consequences that no single layer is responsible for. For example, `vue-router` historically matched routes case-insensitively while Nitro's route rules matcher was case-sensitive, so `routeRules`-based protections could be bypassed with a mixed-case URL ([GHSA-mm7m-92g8-7m47](https://github.com/nuxt/nuxt/security/advisories/GHSA-mm7m-92g8-7m47)). If Nuxt's composition of its dependencies creates a gap like this, that is a valid Nuxt report.

## What we consider a valid vulnerability

A valid report shows that Nuxt itself breaks a security guarantee a reasonable developer would rely on, in an application written following our documentation. Examples of things we have accepted and fixed:

- Bypassing server-enforced access-control mechanisms Nuxt provides
- Cross-user data leakage in SSR, payload caching, or shared server state
- XSS through Nuxt's own APIs and components when used as documented (e.g. `<NuxtLink>`, `navigateTo`, head components)
- Server-side code execution or resource exhaustion through Nuxt endpoints
- Dev-server issues exploitable by a *remote* party: a malicious website reaching the dev server, LAN exposure, or leaking project information to origins that shouldn't have it

A working proof of concept against a minimal, unmodified `nuxt` starter project (or a clear explanation of why one isn't possible) helps us verify and fix the issue much faster.

## What is out of scope

We want to keep space for genuine reports, which means being explicit about what we won't accept:

- **Vulnerable application code.** Nuxt cannot defend against code that is insecure in the first place. Reports whose proof of concept requires the app author to do something our documentation warns against are not Nuxt vulnerabilities. That includes, for example:
  - passing untrusted input to `v-html`, `innerHTML` in [`useHead`](https://nuxt.com/docs/4.x/api/composables/use-head) (use [`useHeadSafe`](https://nuxt.com/docs/4.x/api/composables/use-head-safe)), or the `placeholder`/`fallback` props of `<NuxtClientFallback>`
  - compiling templates from user input with the Vue runtime compiler (this is equivalent to `eval`),
  - putting secrets in `runtimeConfig.public`, or otherwise rendering private runtime config to the client
  - interpolating user input into `createError` messages, redirects, or dynamic component resolution (`<component :is>`, polymorphic `as` props) without validation
  - failing to validate anything that is user-controlled, such as [props passed to a server component](https://nuxt.com/docs/4.x/guide/concepts/server-components), which come from the request and must be treated as untrusted input
- **Documented trust boundaries and limitations.** Some behaviours are explicitly documented as the developer's responsibility, and reports that restate them are not vulnerabilities. For example, [server component / island props](https://nuxt.com/docs/4.x/guide/concepts/server-components) are sent as GET query parameters (so they may appear in access logs, CDN caches, and `Referer` headers) and route middleware does not run when rendering islands; the [`source` prop of `<NuxtIsland>`](https://nuxt.com/docs/4.x/api/components/nuxt-island) means fully trusting the remote server's HTML, and `dangerouslyLoadClientComponents` is dangerous by name and by design. Route middleware is a DX feature, not a security boundary: it runs on the client as well, and anything running on the client can be overridden by the user, so "I skipped route middleware from my own browser" is not a vulnerability (protect data on the server, where the user cannot tamper with it). Similarly, the hash in island endpoint URLs exists to prevent cache poisoning, not to act as an authorisation mechanism; anyone who can reach the endpoint can render islands, and reports treating the hash as an access-control bypass are not valid. A report showing Nuxt *violating* one of its documented guarantees is valid; a report demonstrating a documented limitation is not.
- **Attacks that assume prototype pollution has already occurred.** If the proof of concept starts by polluting `Object.prototype` (or otherwise assumes an attacker can already execute JavaScript in the relevant context), the vulnerability lies with whatever allowed that, not with Nuxt code that subsequently reads a polluted property.
- **Dependency CVEs without a Nuxt exploit path.** A vulnerability advisory in one of our (transitive) dependencies, reported by `npm audit` or a scanner, is not itself a Nuxt vulnerability. We keep dependencies up to date as part of normal maintenance. It becomes a valid report only if you can show that Nuxt's usage of the dependency makes the vulnerability exploitable in a Nuxt app.
- **Missing hardening, not broken guarantees.** Absence of security headers, CSP, rate limiting, and similar defence-in-depth measures are application-level concerns, not vulnerabilities in Nuxt.
- **Attacks that require an already-compromised machine.** If the proof of concept starts with the attacker running arbitrary code or commands on the developer's or server's machine, the machine is already compromised and Nuxt is not the boundary that failed. (Dev-server issues reachable remotely, as above, are in scope.)
- **Self-XSS and issues requiring the victim to attack themselves**, such as pasting a payload into their own devtools or config.
- **Automated scanner output submitted without analysis.** Reports that are clearly LLM- or tool-generated, assert a vulnerability without a working reproduction, or describe intended behaviour as a flaw consume triage time that would otherwise go to real reports. Repeated low-quality submissions may cause future reports from the same source to be deprioritised.

If you're genuinely unsure whether something qualifies, err on the side of reporting it privately. We would much rather triage a borderline report than miss a real issue.
