import { Server, Listener } from '../src'

jest.mock('../src/server', () => ({
  server: true
})).mock('../src/listener', () => ({
  listener: true
}))

describe('server: entry', () => {
  test('should export Server and Listener', () => {
    expect(Server.server).toEqual(true)
    expect(Listener.listener).toEqual(true)
  })
})
