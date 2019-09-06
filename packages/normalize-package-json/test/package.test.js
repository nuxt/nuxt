
import { Package } from '../src/package'
import fixtures from './fixtures'

describe('normalize-package-json', () => {
  test('autoFix should sort', () => {
    const fixture = fixtures('package-unsorted')
    const subject = new Package({ ...fixture })
    subject.autoFix()
    expect(subject.toString()).toMatchSnapshot()
  })

  test('copyFields', () => {
    const fixture = fixtures('syncing-files-between-packages')

    // Typical lerna monorepo root, with a package.json, and children
    // under packages/*/package.json
    const subject = new Package({ ...fixture })

    // Assuming we have packages foo and bar we want to copy field values
    const foo = subject.load('packages/foo')
    expect(foo.pkg).not.toHaveProperty('license')
    expect(foo.pkg).not.toHaveProperty('author')
    const bar = subject.load('packages/bar')
    expect(bar.pkg).not.toHaveProperty('license')
    expect(bar.pkg).not.toHaveProperty('author')

    // Copy values around
    foo.copyFieldsFrom(subject, ['license', 'author'])
    bar.copyFieldsFrom(subject, ['license', 'author'])

    // Sanity
    expect(foo.pkg).toHaveProperty('license')
    expect(foo.pkg).toHaveProperty('author')
    expect(bar.pkg).toHaveProperty('license')
    expect(bar.pkg).toHaveProperty('author')

    // Snapshot, just for visualization
    foo.autoFix()
    expect(foo.toString()).toMatchSnapshot()
    bar.autoFix()
    expect(bar.toString()).toMatchSnapshot()
  })

  // @TODO: Test copyFilesFrom. But we’d need to mock filsystem writes.
})
