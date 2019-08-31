import { Waiter } from '@hermes-serverless/custom-promises'
import { randomBytes } from 'crypto'
import http, { RequestListener } from 'http'
import { Watcher } from '../../../resources/RunsManager/WatchersManager/Watcher'
import { Logger } from '../../../utils/Logger'
import { sleep } from '../utils'

Logger.enabled = false

jest.mock('../../../resources/DockerInterface/DockerContainer', () => {
  return {
    DockerContainer: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
    })),
  }
})

jest.mock('../../../resources/RedisWrapper', () => {
  return {
    RedisWrapper: {
      addSubscription: jest.fn(),
      removeSubscription: jest.fn(),
    },
  }
})

jest.mock('../../../utils/ResettableTimer', () => {
  return {
    ResettableTimer: jest.fn().mockImplementation(() => ({
      stop: jest.fn(),
      start: jest.fn(),
      reset: jest.fn(),
    })),
  }
})

const RedisWrapper: any = require('../../../resources/RedisWrapper').RedisWrapper
const DockerContainer: any = require('../../../resources/DockerInterface/DockerContainer').DockerContainer

const mockWatcher = (w: any) => {
  w.datasource = {
    deleteRun: jest.fn().mockResolvedValue('deleteRun'),
    getRunStatus: jest.fn().mockResolvedValue('getRunStatus'),
    getResultInfo: jest.fn().mockResolvedValue('getResultInfo'),
    getResultOutput: jest.fn().mockResolvedValue('getResultOutput'),
    shutdown: jest.fn().mockResolvedValue('shutdown'),
  }
  w.baseURL = 'http://localhost:23004/'
  return w
}

const closeServer = (server: http.Server, waiter: Waiter<any>) => {
  server.close(err => {
    if (err) waiter.reject(err)
    waiter.resolve()
  })
}

const setupServer = (port: number, fn: RequestListener) => {
  const waiter = new Waiter()
  const server = http.createServer(fn)
  server.listen(port)
  const close = () => {
    closeServer(server, waiter)
  }
  return { server, close, waiter, port }
}

const setupSource = (fn: RequestListener) => {
  const { server: source, close: closeSource, waiter: sourceWaiter, port } = setupServer(23003, fn)
  return { source, closeSource, sourceWaiter, port }
}

const setupDest = (fn: RequestListener) => {
  const { server: dest, close: closeDest, waiter: destWaiter, port } = setupServer(23004, fn)
  return { dest, closeDest, destWaiter, port }
}

const finishRun = (w: any, runID: string, redisWrapper = RedisWrapper) => {
  expect(redisWrapper.addSubscription).toBeCalledTimes(1)
  expect(redisWrapper.addSubscription.mock.calls[0][0]).toBe(w.watcherName)
  redisWrapper.addSubscription.mock.calls[0][2]('', `RUN-DONE ${runID}`)
  expect(redisWrapper.removeSubscription).toBeCalledTimes(1)
  expect(redisWrapper.removeSubscription.mock.calls[0][0]).toBe(w.watcherName)
  expect(redisWrapper.removeSubscription.mock.calls[0][1]).toBe(redisWrapper.addSubscription.mock.calls[0][1])
}

const finishStart = (w: any, error = false, redisWrapper = RedisWrapper) => {
  expect(redisWrapper.addSubscription).toBeCalledTimes(1)
  expect(redisWrapper.addSubscription.mock.calls[0][0]).toBe(w.watcherName)
  if (error) {
    redisWrapper.addSubscription.mock.calls[0][2]('', `STARTUP-ERROR`)
  } else redisWrapper.addSubscription.mock.calls[0][2]('', `STARTUP-SUCCESS`)
  expect(redisWrapper.removeSubscription).toBeCalledTimes(1)
  expect(redisWrapper.removeSubscription.mock.calls[0][0]).toBe(w.watcherName)
  expect(redisWrapper.removeSubscription.mock.calls[0][1]).toBe(redisWrapper.addSubscription.mock.calls[0][1])
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Constructor', () => {
  test('DockerContainer arguments are correct', () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    expect(DockerContainer).toBeCalledTimes(1)
    expect(DockerContainer).toBeCalledWith(w.id, {
      imageName: 'someDockerImage',
      gpuCapable: false,
      port: 3000,
      dnsName: `watcher-1_${w.id}`,
      detach: true,
      network: 'hermes',
      envVariables: [`REDIS_CHANNEL=watcher-1_${w.id}`],
    })
  })

  test('DockerContainer arguments are correct when network is defined by process.env.HERMES_NETWORK', () => {
    process.env.HERMES_NETWORK = 'hermes-test'
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    expect(DockerContainer).toBeCalledTimes(1)
    expect(DockerContainer).toBeCalledWith(w.id, {
      imageName: 'someDockerImage',
      gpuCapable: false,
      port: 3000,
      dnsName: `watcher-1_${w.id}`,
      detach: true,
      network: 'hermes-test',
      envVariables: [`REDIS_CHANNEL=watcher-1_${w.id}`],
    })
    delete process.env.HERMES_NETWORK
  })

  test('BaseURL is correct', () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    expect(w.baseURL).toBe(`http://watcher-1_${w.id}:3000/`)
  })
})

describe('Run', () => {
  describe('Proxy and Redis event', () => {
    test('Proxies a run request adding runID', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      const id = randomBytes(8).toString('hex')
      const { closeSource, sourceWaiter, port } = setupSource(async (req, res) => {
        const p = w.run(req, res, id, 'sync')
        finishRun(w, id)
        await p
      })

      const { closeDest, destWaiter } = setupDest((req, res) => {
        expect(req.headers['x-run-id']).toBe(id)
        res.end()
        closeSource()
        closeDest()
      })

      http.request(`http://localhost:${port}`, () => {}).end()
      await sourceWaiter.finish()
      await destWaiter.finish()
    })

    test('Throws when proxy return error', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      const id = randomBytes(8).toString('hex')
      const { closeSource, sourceWaiter, port } = setupSource(async (req, res) => {
        await expect(w.run(req, res, id, 'sync')).rejects.toThrow('ECONNREFUSED')
        res.end()
        closeSource()
      })

      http.request(`http://localhost:${port}`, () => {}).end()
      await sourceWaiter.finish()
    })
  })

  describe('Endpoint', () => {
    let WatcherMock: any
    let ProxyMock: any
    let RedisWrapperMock: any
    beforeAll(() => {
      jest.resetModules()
      jest.doMock('../../../resources/ProxyServer', () => {
        return {
          Proxy: {
            redirect: jest.fn(),
          },
        }
      })
      ProxyMock = require('../../../resources/ProxyServer').Proxy
      WatcherMock = require('../../../resources/RunsManager/WatchersManager/Watcher').Watcher
      RedisWrapperMock = require('../../../resources/RedisWrapper').RedisWrapper
    })

    afterAll(() => {
      jest.unmock('../../../resources/ProxyServer')
    })

    test('Async endpoint is correct', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new WatcherMock({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      const id = randomBytes(8).toString('hex')
      const p = w.run(jest.fn(), jest.fn(), id, 'async')
      expect(ProxyMock.redirect).toBeCalledTimes(1)
      expect(ProxyMock.redirect.mock.calls[0][2]).toBe('http://localhost:23004/run/async')
      finishRun(w, id, RedisWrapperMock)
      await p
    })

    test('Sync endpoint is correct', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new WatcherMock({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      const id = randomBytes(8).toString('hex')
      const p = w.run(jest.fn(), jest.fn(), id, 'sync')
      expect(ProxyMock.redirect).toBeCalledTimes(1)
      expect(ProxyMock.redirect.mock.calls[0][2]).toBe('http://localhost:23004/run/sync')
      finishRun(w, id, RedisWrapperMock)
      await p
    })
  })

  describe('Shutdown timer', () => {
    test('On success the timer is reset', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      expect(w.canShutdown).toBe(false)
      w.canShutdown = true
      const id = randomBytes(8).toString('hex')
      const { closeSource, sourceWaiter, port } = setupSource(async (req, res) => {
        expect(w.canShutdown).toBe(true)
        expect(w.timer.start).toBeCalledTimes(0)
        expect(w.timer.stop).toBeCalledTimes(0)
        const p = w.run(req, res, id, 'sync')
        expect(w.canShutdown).toBe(false)
        expect(w.timer.start).toBeCalledTimes(0)
        expect(w.timer.stop).toBeCalledTimes(1)
        finishRun(w, id)
        await p
        await sleep(500)
        expect(w.timer.start).toBeCalledTimes(1)
        expect(w.canShutdown).toBe(true)
        expect(w.timer.stop).toBeCalledTimes(1)
        closeSource()
        closeDest()
      })

      const { closeDest, destWaiter } = setupDest(async (req, res) => {
        expect(req.headers['x-run-id']).toBe(id)
        res.end()
      })

      http.request(`http://localhost:${port}`, () => {}).end()
      await sourceWaiter.finish()
      await destWaiter.finish()
    })

    test('On error the shutdown is reset', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      expect(w.canShutdown).toBe(false)
      w.canShutdown = true
      const id = randomBytes(8).toString('hex')
      const { closeSource, sourceWaiter, port } = setupSource(async (req, res) => {
        expect(w.canShutdown).toBe(true)
        expect(w.timer.start).toBeCalledTimes(0)
        expect(w.timer.stop).toBeCalledTimes(0)
        const p = w.run(req, res, id, 'sync')
        expect(w.canShutdown).toBe(false)
        expect(w.timer.start).toBeCalledTimes(0)
        expect(w.timer.stop).toBeCalledTimes(1)
        await expect(p).rejects.toThrow('ECONNREFUSED')
        res.end()
        await sleep(500)
        expect(w.timer.start).toBeCalledTimes(1)
        expect(w.canShutdown).toBe(true)
        expect(w.timer.stop).toBeCalledTimes(1)
        closeSource()
      })

      http.request(`http://localhost:${port}`, () => {}).end()
      await sourceWaiter.finish()
    })

    test('On shutdown the timer is stopped', async () => {
      const onShutdown = jest.fn()
      const w: any = mockWatcher(
        new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
      )
      const startCalls = w.timer.start.mock.calls.length
      const stopCalls = w.timer.stop.mock.calls.length
      w.canShutdown = true
      await expect(w.shutdown()).resolves.toBe('shutdown')
      expect(onShutdown).toBeCalledTimes(1)
      expect(w.timer.stop).toBeCalledTimes(stopCalls + 1)
      expect(w.timer.start).toBeCalledTimes(startCalls)
    })
  })
})

describe('Start', () => {
  test('Redis listeners when DockerContainer is started successfully', async () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    w.container.start.mockResolvedValueOnce(undefined)
    const p = w.start()
    expect(w.container.start).toBeCalledTimes(1)
    finishStart(w)
    await expect(p).resolves.toBe(`watcher-1_${w.id}`)
  })

  test('Redis listeners when DockerContainer throws error', async () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    const err = new Error('MOCK_ERROR')
    w.container.start.mockRejectedValueOnce(err)
    const p = w.start()
    expect(w.container.start).toBeCalledTimes(1)
    expect(RedisWrapper.addSubscription).toBeCalledTimes(1)
    expect(RedisWrapper.addSubscription.mock.calls[0][0]).toBe(w.watcherName)
    await expect(p).rejects.toThrow('Watcher startup error')
    expect(RedisWrapper.removeSubscription).toBeCalledTimes(1)
    expect(RedisWrapper.removeSubscription.mock.calls[0][0]).toBe(w.watcherName)
    expect(RedisWrapper.removeSubscription.mock.calls[0][1]).toBe(RedisWrapper.addSubscription.mock.calls[0][1])
  })

  test('Shutdown timer is started on success', async () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    w.container.start.mockResolvedValueOnce(undefined)
    const p = w.start()
    expect(w.timer.start).toBeCalledTimes(0)
    finishStart(w)
    await expect(p).resolves.toBe(`watcher-1_${w.id}`)
    expect(w.timer.start).toBeCalledTimes(1)
  })

  test('Shutdown timer is not started on DockerContainer error', async () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    const err = new Error('MOCK_ERROR')
    w.container.start.mockRejectedValueOnce(err)
    const p = w.start()
    await expect(p).rejects.toThrow('Watcher startup error')
    expect(w.timer.start).toBeCalledTimes(0)
  })

  test('Shutdown timer is not started on container startup error', async () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    w.container.start.mockResolvedValueOnce(undefined)
    const p = w.start()
    finishStart(w, true)
    await expect(p).rejects.toThrow(`Watcher startup error`)
    expect(w.timer.start).toBeCalledTimes(0)
  })
})

describe('Shutdown', () => {
  test('Shuts down when canShutdown is true', () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    w.datasource = {
      shutdown: jest.fn(),
    }
    expect(w.canShutdown).toBe(false)
    w.canShutdown = true
    expect(onShutdown).toBeCalledTimes(0)
    w.shutdown()
    expect(onShutdown).toBeCalledTimes(1)
    expect(onShutdown).toBeCalledWith(w.id)
    expect(w.datasource.shutdown).toBeCalledTimes(1)
  })

  test('Does nothing when canShutdown is false', () => {
    const onShutdown = jest.fn()
    const w: any = new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    w.datasource = {
      shutdown: jest.fn(),
    }
    w.canShutdown = false
    w.shutdown()
    expect(onShutdown).toBeCalledTimes(0)
    expect(w.datasource.shutdown).toBeCalledTimes(0)
  })
})

describe('Interaction with WatcherDatasource', () => {
  test('Delete Run', async () => {
    const onShutdown = jest.fn()
    const w: any = mockWatcher(
      new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    )
    await expect(w.deleteRunData(1)).resolves.toBe('deleteRun')
    expect(w.datasource.deleteRun).toBeCalledTimes(1)
    expect(w.datasource.deleteRun).toBeCalledWith(1)
  })

  test('Get Run Status - no additionalFields', async () => {
    const onShutdown = jest.fn()
    const w: any = mockWatcher(
      new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    )
    await expect(w.getRunStatus(1)).resolves.toBe('getRunStatus')
    expect(w.datasource.getRunStatus).toBeCalledTimes(1)
    expect(w.datasource.getRunStatus).toBeCalledWith(1, undefined)
  })

  test('Get Run Status - additionalFields', async () => {
    const onShutdown = jest.fn()
    const w: any = mockWatcher(
      new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    )
    await expect(w.getRunStatus(1, ['out'])).resolves.toBe('getRunStatus')
    expect(w.datasource.getRunStatus).toBeCalledTimes(1)
    expect(w.datasource.getRunStatus).toBeCalledWith(1, ['out'])
  })

  test('Get Result Info', async () => {
    const onShutdown = jest.fn()
    const w: any = mockWatcher(
      new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    )
    await expect(w.getResultInfo(1)).resolves.toBe('getResultInfo')
    expect(w.datasource.getResultInfo).toBeCalledTimes(1)
    expect(w.datasource.getResultInfo).toBeCalledWith(1)
  })

  test('Get Result Output', async () => {
    const onShutdown = jest.fn()
    const w: any = mockWatcher(
      new Watcher({ onShutdown, imageName: 'someDockerImage', gpuCapable: false, functionID: '1' })
    )
    await expect(w.getResultOutput(1)).resolves.toBe('getResultOutput')
    expect(w.datasource.getResultOutput).toBeCalledTimes(1)
    expect(w.datasource.getResultOutput).toBeCalledWith(1)
  })
})
