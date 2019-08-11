import { Waiter } from '@hermes-serverless/custom-promises'
import { randomBytes } from 'crypto'
import { ProducerConsumer, WatcherQueue } from '../../resources/RunsManager/WatchersManager/WatcherQueue'
import { Logger } from '../../utils/Logger'

Logger.enabled = false
const Watcher: any = require('../../resources/RunsManager/WatchersManager/Watcher').Watcher
jest.mock('../../resources/RunsManager/WatchersManager/Watcher', () => {
  return {
    Watcher: jest.fn(),
  }
})

const createMockWatcher = (canAcceptNewRuns = true) => {
  const id = randomBytes(8).toString('hex')
  const w = new Watcher()
  w.watcherID = id
  w.canAcceptNewRuns = canAcceptNewRuns
  return w
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ProducerConsumer', () => {
  const checkItems = (pc: any, items: any[]) => {
    expect(pc.items.toArray()).toEqual(items)
    expect(pc.itemsNumber()).toBe(items.length)
  }

  const checkReqsNumber = (pc: any, reqsNumber: number) => {
    expect(pc.requestsNumber()).toBe(reqsNumber)
  }

  test('Add and Consume', async () => {
    const pc: any = new ProducerConsumer()
    const arr = [createMockWatcher(), createMockWatcher()]

    pc.add(arr[0])
    checkItems(pc, [arr[0]])
    checkReqsNumber(pc, 0)

    await expect(pc.consume()).resolves.toBe(arr[0])
    checkItems(pc, [])
    checkReqsNumber(pc, 0)

    const p = pc.consume()
    expect(pc.requests.length).toBe(1)
    setTimeout(() => pc.add(arr[1]), 1000)
    await expect(p).resolves.toBe(arr[1])
    checkItems(pc, [])
    checkReqsNumber(pc, 0)
  })

  test('Consume timeout', async () => {
    jest.useFakeTimers()
    const pc: any = new ProducerConsumer()
    const p = pc.consume()
    checkReqsNumber(pc, 1)
    jest.runAllTimers()
    await expect(p).rejects.toThrow('Timeout error')
    jest.useRealTimers()
  })

  test('Add many and consume', async () => {
    const pc: any = new ProducerConsumer()
    const arr = [createMockWatcher(), createMockWatcher(), createMockWatcher(), createMockWatcher()]
    pc.add(arr[0])
    pc.add(arr[1])
    pc.add(arr[2])
    pc.add(arr[3])
    arr[0].canAcceptNewRuns = false
    checkItems(pc, arr)
    await expect(pc.consume()).resolves.toBe(arr[1])
    await expect(pc.consume()).resolves.toBe(arr[2])
    await expect(pc.consume()).resolves.toBe(arr[3])
    checkItems(pc, [])
    checkReqsNumber(pc, 0)
  })

  test('_maybeFulfillRequest removes items that cant acceptNewRequests', () => {
    const pc: any = new ProducerConsumer()
    const arr = [createMockWatcher(), createMockWatcher(), createMockWatcher(), createMockWatcher()]
    pc.add(arr[0])
    pc.add(arr[1])
    pc.add(arr[2])
    pc.add(arr[3])
    checkItems(pc, arr)
    arr[0].canAcceptNewRuns = false
    arr[1].canAcceptNewRuns = false
    arr[3].canAcceptNewRuns = false
    pc._maybeFulfillRequest()
    checkItems(pc, [arr[2], arr[3]])
  })

  test('Request to consume many and add afterwards', async () => {
    const pc: any = new ProducerConsumer()
    const arr = [createMockWatcher(), createMockWatcher(), createMockWatcher(), createMockWatcher()]

    const pArr = [pc.consume(), pc.consume(), pc.consume()]
    checkReqsNumber(pc, 3)
    setTimeout(() => {
      pc.add(arr[0])
      pc.add(arr[1])
      pc.add(arr[2])
      pc.add(arr[3])
    }, 1000)
    await expect(Promise.all(pArr)).resolves.toEqual([arr[0], arr[1], arr[2]])
    checkItems(pc, [arr[3]])
  })
})

describe('WatcherQueue', () => {
  const setSpies = (w: any) => {
    return {
      _createWatcher: jest.spyOn(w, '_createWatcher'),
      producerConsumer: {
        add: jest.spyOn(w.producerConsumer, 'add'),
        consume: jest.spyOn(w.producerConsumer, 'consume'),
      },
    }
  }

  describe('_createWatcher', () => {
    const watcherStart = jest.fn()
    beforeEach(() => {
      Watcher.mockImplementation(() => ({
        start: watcherStart,
        watcherID: randomBytes(8).toString('hex'),
      }))
    })

    test('Watcher Constructor is called correctly', async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatcher()
      await expect(w.watchersStarting[0].promise).resolves.toBe(undefined)
      expect(Watcher).toBeCalledTimes(1)
      expect(Watcher.mock.calls[0][0].imageName).toBe('someDockerImage')
      expect(Watcher.mock.calls[0][0].gpuCapable).toBe(true)
      expect(Watcher.mock.calls[0][0].functionID).toBe('1')
    })

    test('Rigth away success', async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const spies = setSpies(w)
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatcher()
      expect(w.watchersStarting.length).toBe(1)
      await expect(w.watchersStarting[0].promise).resolves.toBe(undefined)
      expect(spies._createWatcher).toBeCalledTimes(1)
      expect(spies.producerConsumer.add).toBeCalledTimes(1)
      expect(w.watchers.length).toBe(1)
    })

    test('Success after one retry', async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const spies = setSpies(w)
      watcherStart.mockRejectedValueOnce(undefined)
      watcherStart.mockResolvedValueOnce(undefined)

      w._createWatcher()
      expect(w.watchersStarting.length).toBe(1)
      await expect(w.watchersStarting[0].promise).rejects.toBe(undefined)
      expect(w.watchersStarting.length).toBe(1)
      expect(spies._createWatcher).toBeCalledTimes(2)
      expect(spies._createWatcher).nthCalledWith(1)
      expect(spies._createWatcher).nthCalledWith(2, 1)
      await expect(w.watchersStarting[0].promise).resolves.toBe(undefined)
      expect(spies._createWatcher).toBeCalledTimes(2)
      expect(spies.producerConsumer.add).toBeCalledTimes(1)
      expect(w.watchersStarting.length).toBe(0)
      expect(w.watchers.length).toBe(1)
    })

    test('Doesnt continue after two tries', async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const spies = setSpies(w)
      watcherStart.mockRejectedValueOnce(undefined)
      watcherStart.mockRejectedValueOnce(undefined)

      w._createWatcher()
      expect(w.watchersStarting.length).toBe(1)
      await expect(w.watchersStarting[0].promise).rejects.toBe(undefined)
      expect(w.watchersStarting.length).toBe(1)
      expect(spies._createWatcher).toBeCalledTimes(2)
      expect(spies._createWatcher).nthCalledWith(1)
      expect(spies._createWatcher).nthCalledWith(2, 1)
      expect(w.watchers.length).toBe(0)
      await expect(w.watchersStarting[0].promise).rejects.toBe(undefined)
      expect(spies._createWatcher).toBeCalledTimes(3)
      expect(spies._createWatcher).nthCalledWith(3, 0)
      expect(spies.producerConsumer.add).toBeCalledTimes(0)
      expect(w.watchersStarting.length).toBe(0)
      expect(w.watchers.length).toBe(0)
    })
  })

  describe('_createWatchers', () => {
    const watcherStart = jest.fn()
    beforeAll(() => {
      Watcher.mockImplementation(() => ({
        start: watcherStart,
        watcherID: randomBytes(8).toString('hex'),
      }))
    })

    test('Create 2 successfully', async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const spies = setSpies(w)
      watcherStart.mockResolvedValueOnce(undefined)
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatchers(2)
      expect(w.watchersStarting.length).toBe(2)
      expect(w._createWatcher).toBeCalledTimes(2)
      await expect(Promise.all(w.watchersStarting.map((el: any) => el.promise))).resolves.toEqual([
        undefined,
        undefined,
      ])
      expect(w._createWatcher).toBeCalledTimes(2)
      expect(spies.producerConsumer.add).toBeCalledTimes(2)
      expect(w.watchersStarting).toEqual([])
    })
  })

  describe('getWatcher', () => {
    test.each([
      [0, 0, 0, 2],
      [0, 0, 1, 4],
      [1, 0, 1, 3],
      [1, 1, 1, 2],
      [1, 2, 3, 5],
      [1, 1, 0, 0],
      [1, 5, 6, 8],
      [2, 3, 1, 0],
      [2, 3, 2, 1],
    ])(
      'getWatcher calls _createWatchers and consume correctly: watchersStarting[%s] itemsNumber[%s] reqsNumber[%s]',
      async (watchersStarting, itemsNumber, reqsNumber, watchersToCreate) => {
        const onDone = jest.fn()
        const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
        w.producerConsumer.consume = jest.fn()
        w.producerConsumer.itemsNumber = jest.fn().mockReturnValue(itemsNumber)
        w.producerConsumer.requestsNumber = jest.fn().mockReturnValue(reqsNumber + 1)
        w.watchersStarting = Array(watchersStarting).fill(0)
        expect(w.watchersStarting.length).toBe(watchersStarting)
        w._createWatchers = jest.fn()
        w.getWatcher()
        expect(w.producerConsumer.consume).toBeCalledTimes(1)
        if (watchersToCreate > 0) {
          expect(w._createWatchers).toBeCalledTimes(1)
          expect(w._createWatchers).toBeCalledWith(watchersToCreate)
        }
      }
    )
  })

  describe('onDone', () => {
    const watcherStart = jest.fn()
    beforeEach(() => {
      Watcher.mockImplementation(({ onShutdown }: any) => ({
        onShutdown,
        start: watcherStart,
        watcherID: randomBytes(8).toString('hex'),
      }))
    })

    test(`Finishes when last watcher shuts down and there's no watcher starting`, async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const waiter = new Waiter()
      watcherStart.mockReset()
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatcher(1)
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatcher(1)
      watcherStart.mockReturnValueOnce(waiter.finish())
      w._createWatcher(1)
      await expect(Promise.all(w.watchersStarting.slice(0, 2).map((el: any) => el.promise))).resolves.toEqual([
        undefined,
        undefined,
      ])
      expect(w.watchersStarting.length).toBe(1)
      expect(w.watchers.length).toBe(2)
      const [w1, w2] = w.watchers
      w1.onShutdown(w1.watcherID)
      w2.onShutdown(w2.watcherID)
      expect(w.watchersStarting.length).toBe(1)
      expect(w.watchers.length).toBe(0)
      waiter.resolve()
      await expect(w.watchersStarting[0].promise).resolves.toBeUndefined()
      expect(w.watchersStarting.length).toBe(0)
      expect(w.watchers.length).toBe(1)
      expect(onDone).toBeCalledTimes(0)
      w.watchers[0].onShutdown(w.watchers[0].watcherID)
      expect(onDone).toBeCalledTimes(1)
    })

    test(`Finishes when there's no more watchers switched on and last watcher starting finishes error`, async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const waiter = new Waiter()
      watcherStart.mockReset()
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatcher(1)
      watcherStart.mockResolvedValueOnce(undefined)
      w._createWatcher(1)
      watcherStart.mockReturnValueOnce(waiter.finish())
      w._createWatcher(1)
      await expect(Promise.all(w.watchersStarting.slice(0, 2).map((el: any) => el.promise))).resolves.toEqual([
        undefined,
        undefined,
      ])
      expect(w.watchersStarting.length).toBe(1)
      expect(w.watchers.length).toBe(2)
      const [w1, w2] = w.watchers
      w1.onShutdown(w1.watcherID)
      w2.onShutdown(w2.watcherID)
      expect(w.watchersStarting.length).toBe(1)
      expect(w.watchers.length).toBe(0)
      expect(onDone).toBeCalledTimes(0)
      waiter.reject()
      await expect(w.watchersStarting[0].promise).rejects.toBeUndefined()
      expect(w.watchersStarting.length).toBe(0)
      expect(w.watchers.length).toBe(0)
      expect(onDone).toBeCalledTimes(1)
    })

    test(`Finishes when there's no more watchers switched on and last watcher starting finishes error - tries > 1`, async () => {
      const onDone = jest.fn()
      const w: any = new WatcherQueue({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' }, onDone)
      const waiter = new Waiter()
      watcherStart.mockReset()
      watcherStart.mockRejectedValue(undefined)
      w._createWatcher(2)
      watcherStart.mockReturnValueOnce(waiter.finish())
      await expect(w.watchersStarting[0].promise).rejects.toBeUndefined()
      expect(w.watchersStarting.length).toBe(1)
      expect(w.watchers.length).toBe(0)
      expect(onDone).toBeCalledTimes(0)
      waiter.reject()
      await expect(w.watchersStarting[0].promise).rejects.toBeUndefined()
      expect(w.watchersStarting.length).toBe(0)
      expect(w.watchers.length).toBe(0)
      expect(onDone).toBeCalledTimes(1)
    })
  })
})
