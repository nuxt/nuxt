import consola from 'consola'
import fs from 'fs-extra'
import properlock from 'proper-lockfile'
import onExit from 'signal-exit'
import { lockPaths, defaultLockOptions, getLockOptions, createLockPath, getLockPath, lock } from '../src/locking'

jest.mock('fs-extra')
jest.mock('proper-lockfile')
jest.mock('signal-exit')

describe('util: locking', () => {
  const lockConfig = {
    id: 'id',
    dir: 'dist',
    root: '/project-root'
  }

  beforeEach(() => jest.resetAllMocks())
  beforeEach(() => lockPaths.clear())

  test('onCompromised lock warns on compromise by default', () => {
    defaultLockOptions.onCompromised()
    expect(consola.warn).toHaveBeenCalledTimes(1)
  })

  test('can override default options', () => {
    const options = getLockOptions({ onCompromised: err => consola.fatal(err) })
    options.onCompromised()

    expect(consola.fatal).toHaveBeenCalledTimes(1)
  })

  test('createLockPath creates the same lockPath for identical locks', () => {
    const path1 = createLockPath(lockConfig)
    const path2 = createLockPath(Object.assign({}, lockConfig))
    expect(path1).toBe(path2)
  })

  test('createLockPath creates unique lockPaths for different ids', () => {
    const path1 = createLockPath(lockConfig)
    const path2 = createLockPath(Object.assign({}, lockConfig, { id: 'id2' }))
    expect(path1).not.toBe(path2)
  })

  test('createLockPath creates unique lockPaths for different dirs', () => {
    const path1 = createLockPath(lockConfig)
    const path2 = createLockPath(Object.assign({}, lockConfig, { dir: 'dir2' }))
    expect(path1).not.toBe(path2)
  })

  test('createLockPath creates unique lockPaths for different roots', () => {
    const path1 = createLockPath(lockConfig)
    const path2 = createLockPath(Object.assign({}, lockConfig, { root: '/project-root2' }))
    expect(path1).not.toBe(path2)
  })

  test('getLockPath creates lockPath when it doesnt exists', () => {
    getLockPath(lockConfig)

    expect(fs.ensureDir).toHaveBeenCalledTimes(1)
  })

  test('lock creates a lock and returns a release fn', async () => {
    properlock.lock.mockReturnValue(true)

    const fn = await lock(lockConfig)

    expect(properlock.check).toHaveBeenCalledTimes(1)
    expect(properlock.lock).toHaveBeenCalledTimes(1)
    expect(fs.ensureDir).toHaveBeenCalledTimes(1)
    expect(fn).toEqual(expect.any(Function))
    expect(consola.error).not.toHaveBeenCalled()
    expect(consola.fatal).not.toHaveBeenCalled()
    expect(consola.warn).not.toHaveBeenCalled()
  })

  test('lock throws error when lock already exists', async () => {
    properlock.check.mockReturnValue(true)

    await lock(lockConfig)
    expect(properlock.check).toHaveBeenCalledTimes(1)
    expect(consola.fatal).toHaveBeenCalledTimes(1)
    expect(consola.fatal).toHaveBeenCalledWith(`A lock with id '${lockConfig.id}' already exists on ${lockConfig.dir}`)
  })

  test('lock logs warning when it couldnt get a lock', async () => {
    properlock.lock.mockReturnValue(false)

    const fn = await lock(lockConfig)
    expect(fn).toBe(false)
    expect(properlock.lock).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(`Unable to get a lock with id '${lockConfig.id}' on ${lockConfig.dir} (but will continue)`)
  })

  test('lock logs warning when proper.lock threw error', async () => {
    properlock.lock.mockImplementation(() => {
      throw new Error('test error')
    })

    await lock(lockConfig)
    expect(properlock.lock).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(`Unable to get a lock with id '${lockConfig.id}' on ${lockConfig.dir} (but will continue)`)
  })

  test('lock returns a release method for unlocking both lockfile as lockPath', async () => {
    const release = jest.fn()
    properlock.lock.mockImplementation(() => release)

    const fn = await lock(lockConfig)
    await fn()

    expect(release).toHaveBeenCalledTimes(1)
    expect(fs.remove).toHaveBeenCalledTimes(1)
  })

  test('lock release also cleanup onExit set', async () => {
    const release = jest.fn()
    properlock.lock.mockImplementation(() => release)

    const fn = await lock(lockConfig)
    expect(lockPaths.size).toBe(1)

    await fn()
    expect(lockPaths.size).toBe(0)
  })

  test('lock release only logs error when error thrown', async () => {
    const release = jest.fn(() => {
      throw new Error('test error')
    })
    properlock.lock.mockImplementation(() => release)

    const fn = await lock(lockConfig)
    await expect(fn()).resolves.not.toThrow()

    expect(consola.debug).toHaveBeenCalledTimes(1)
  })

  test('lock check only logs error when error thrown', async () => {
    const testError = new Error('check error')
    properlock.lock.mockImplementation(() => () => {})
    properlock.check.mockImplementation(() => {
      throw testError
    })

    const fn = await lock(lockConfig)
    expect(fn).toEqual(expect.any(Function))

    expect(consola.debug).toHaveBeenCalledTimes(1)
    expect(consola.debug).toHaveBeenCalledWith(`Check for an existing lock with id '${lockConfig.id}' on ${lockConfig.dir} failed`, testError)
  })

  test('lock release doesnt log error when error thrown because lock compromised', async () => {
    fs.exists.mockReturnValue(true)
    const testError = new Error('Lock is already released')
    const release = jest.fn(() => {
      throw testError
    })

    properlock.lock.mockImplementation((path, options) => {
      options.onCompromised()
      return release
    })

    const fn = await lock({
      ...lockConfig,
      options: {
        // overwrite default compromised which calls consola.warn
        onCompromised () {}
      }
    })

    await expect(fn()).resolves.not.toThrow()
    expect(consola.warn).not.toHaveBeenCalled()
  })

  test('lock sets exit listener once to remove lockPaths', async () => {
    properlock.lock.mockReturnValue(true)

    await lock(lockConfig)
    await lock(lockConfig)

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  test('exit listener removes all lockPaths when called', async () => {
    properlock.lock.mockReturnValue(true)

    let callback
    onExit.mockImplementation(cb => (callback = cb))

    const lockConfig2 = Object.assign({}, lockConfig, { id: 'id2' })

    const path1 = createLockPath(lockConfig)
    const path2 = createLockPath(lockConfig2)

    await lock(lockConfig)
    await lock(lockConfig2)

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(lockPaths.size).toBe(2)
    expect(callback).toBeDefined()
    callback()

    expect(fs.removeSync).toHaveBeenCalledWith(path1)
    expect(fs.removeSync).toHaveBeenCalledWith(path2)
  })

  test('lock uses setLockOptions to set defaults', async () => {
    const spy = properlock.lock.mockReturnValue(true)

    await lock(lockConfig)

    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(Object))
    const options = spy.mock.calls[0][1]
    expect(options.stale).toBeDefined()
    expect(options.onCompromised).toBeDefined()
    expect(() => options.onCompromised()).not.toThrow()
    expect(consola.fatal).not.toHaveBeenCalled()
  })
})
