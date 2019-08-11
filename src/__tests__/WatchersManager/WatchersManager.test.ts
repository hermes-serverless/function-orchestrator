import { Logger } from '../../utils/Logger'

Logger.enabled = false
const WatchersManager: any = require('../../resources/RunsManager/WatchersManager').WatchersManager
const WatcherQueue: any = require('../../resources/RunsManager/WatchersManager/WatcherQueue').WatcherQueue
jest.mock('../../resources/RunsManager/WatchersManager/WatcherQueue', () => {
  return {
    WatcherQueue: jest.fn(),
  }
})

describe(`WatcherQueue is deleted when it's done`, () => {
  beforeEach(() => {
    WatcherQueue.mockImplementation((_: any, onDone: any) => ({
      onDone,
      getWatcher: jest.fn().mockResolvedValue('getWatcher'),
    }))
    WatchersManager.watcherQueues = {}
  })

  test('One WatcherQueue', async () => {
    await expect(
      WatchersManager.getAvailableWatcher({ imageName: 'someDockerImage', gpuCapable: true, functionID: '1' })
    ).resolves.toBe('getWatcher')
    expect(WatchersManager.watcherQueues['1']).not.toBeUndefined()
    expect(WatchersManager.watcherQueues['1'].getWatcher).toBeCalledTimes(1)
    WatchersManager.watcherQueues['1'].onDone()
    expect(WatchersManager.watcherQueues['1']).toBeUndefined()
  })

  test('Two WatcherQueues', async () => {
    await expect(
      WatchersManager.getAvailableWatcher({ imageName: 'someDockerImage', gpuCapable: true, functionID: 'aaa' })
    ).resolves.toBe('getWatcher')
    await expect(
      WatchersManager.getAvailableWatcher({ imageName: 'someDockerImage', gpuCapable: true, functionID: 'bbb' })
    ).resolves.toBe('getWatcher')
    expect(WatchersManager.watcherQueues['aaa']).not.toBeUndefined()
    expect(WatchersManager.watcherQueues['aaa'].getWatcher).toBeCalledTimes(1)
    expect(WatchersManager.watcherQueues['bbb']).not.toBeUndefined()
    expect(WatchersManager.watcherQueues['bbb'].getWatcher).toBeCalledTimes(1)
    WatchersManager.watcherQueues['aaa'].onDone()
    expect(WatchersManager.watcherQueues['aaa']).toBeUndefined()
    expect(WatchersManager.watcherQueues['bbb']).not.toBeUndefined()
    WatchersManager.watcherQueues['bbb'].onDone()
    expect(WatchersManager.watcherQueues['aaa']).toBeUndefined()
    expect(WatchersManager.watcherQueues['bbb']).toBeUndefined()
  })
})
