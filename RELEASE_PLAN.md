## Release Plan

Starting with version `v2.4`, Nuxt will adhere to a formalized release plan (as good as possible).
Also, an end of life for older major versions is defined with this document.

### Major versions (3.x -> 4.0)

Nuxt major releases are planned every **6 months**. This depends on a few factors though:

- If there are no breaking changes waiting for a release, no new major version will be published. Instead, another minor one will be released
- In case of unexpected major updates of important dependencies like Vue, Webpack, and so on, major versions might be released _earlier_ than planned

The goal is to provide a **migration guide** for each major version as well, as escape hatches, so existing code
won't "just break".

### Minor versions (2.1 -> 2.2)

The release cycle for Nuxt.js minor versions is roughly **4 weeks**.

Three of the four weeks will be used for actual **feature implementations** while the last week will be used for
**testing, fixing bugs and thorough audits**.

That also means a _feature freeze_ for the next minor version after these three weeks.
Features that aren't ready will be moved to the next cycle. "Waiting" for features
(for a longer time) will be avoided as good as possible to keep releases lean, concise, predictable and digestible.

### Patch releases (2.2.3 -> 2.2.4)

The last patch releases were mostly _bundled_ fixes or single _hotfixes_.
In the future, fixes will be released **as soon as possible** after the actual PR/commit so people won't have to switch to `nuxt-edge` for bugfixes. This should improve the stability of Nuxt.

Fixes can or will include:

- Updates of dependencies (for various reasons, like a "faulty/buggy" dependency or an newer versions that works better with the Nuxt.js code)
- Fixes for our code

Bugfixes for upcoming features won't be ported of course.

### Edge Release Channel

After experimenting with `nuxt-edge` releases in the last time, the decision to do **nightly releases** for now instead of
releasing a version after _each commit_ was made.

## End of Life

Starting with `v2.4`, every major Nuxt.js version will have an **End of Life**.
Previous releases will receive security updates and bugfixes **for one year and two weeks**, counted from the first release on.
As Nuxt majors are approximately released once every 6 months, this will allow developers to "skip one major version" without being stuck with a broken or unsecure Nuxt.js dependency.
The EOL also applies to the documentation.
