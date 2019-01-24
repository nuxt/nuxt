## Release Plan

Starting with version `v2.4`, the Nuxt core team will adhere to a formalized release plan (as good as possible).
Also, an end of life for older major versions is defined with this document

### Major versions (3.x.y, 4.x.y, ...)

We aim for a major release once every **6 months**. This depends on a few factors though:

* Major version releases of critical dependencies like Vue, Webpack or Babel
* Number of breaking changes "in the queue"

Our goal is to provide a **migration guide** for each major version as well as escape hatches so existing code
won't "just break".

### Minor versions

The team agree on a release cycle of (roughly) **4 weeks**. 

Three of the for weeks will be used for actual **feature implementations** while the last week will be used for 
**testing, fixing bugs and thorough audits**.

That also means a *feature freeze* for the next minor version after these three weeks.
Features that aren't ready will be moved to the next cycle. We try to avoid to "wait" for features 
(for a longer time) to keep releases lean, concise, predictable and digestible.

### Patch releases

The last patch releases were mostly *bundled* fixes or single *hotfixes*. 
In the future we will avoid this practice and try to release each fix **as soon as possible** after the actual PR/commit.
People won't have to switch to `nuxt-edge` for bugfixes then.

Fixes can or will include:

* Updates of dependencies (for various reasons, like a "faulty/buggy" dependency or an newer versions that works better with the Nuxt.js code)
* Fixes for our code

Bugfixes for upcoming features won't be ported of course.

### Edge Release Channel

We've experimented with `nuxt-edge` releases in the last time and decided to do **nightly releases** for now instead of 
releasing a version after *each commit*.

## End of Life

We agreed to set an **End of Life** for older major Nuxt.js versions. 
Previous releases will receive security updates and bugfixes *until two weeks after the second next major release* **\***. 
As we release new majors approximately once every 6 months, this will allow people to "skip one major version" without
being stuck with a buggy or unsecure Nuxt.js dependency.
There will be a detailed migration guide for each major update.
The EOL also applies to the documentation.

**\*** Exceptions, e.g. for critical security fixes, are possible but not guaranteed


### Example
We are on Nuxt 2 right now. When Nuxt three would be released tomorrow, Nuxt 2 would still receive fixes. 
Imagine nuxt 4 would release exactly 1 week after (which is unlikely but for the sake of the example). 
Then the countdown for the End of Life for Nuxt 2 would start. 
Two weeks after the Nuxt 4 release, we will stop maintaining Nuxt 2.
