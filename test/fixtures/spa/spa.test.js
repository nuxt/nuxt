import { buildFixture } from '../../utils/build'

// These two must not build concurrently to avoid changed-files check failing.
// That's why building both from same test file.
buildFixture('spa')
buildFixture('spa-hash')
buildFixture('spa-base')
