import R from 'ramda'
import { Logger } from '../../../utils/Logger'
import { Watcher } from './Watcher'
import { WatcherQueue } from './WatcherQueue'

interface WatcherQueues {
  [key: string]: WatcherQueue
}

export interface RunRequest {
  imageName: string
  gpuCapable: boolean
  functionID: string
}

const addName = (msg: string) => {
  return `[WatcherQueue] ${msg}`
}

export class WatchersManager {
  private static watcherQueues: WatcherQueues = {}

  public static getWatcherByID = (id: string) => {
    const functionID = id.split('_')[0]

    const watcher = R.find(el => {
      return el.getID() === id
    }, WatchersManager.watcherQueues[functionID].getAll())
    if (watcher == null) return null
    return watcher
  }

  public static getAvailableWatcher = (functionID: string) => {
    if (WatchersManager.watcherQueues[functionID] == null) return null
    return WatchersManager.watcherQueues[functionID].getAvailable()
  }

  public static createWatcher = async (runRequest: RunRequest) => {
    const { functionID } = runRequest

    const onShutdown = (watcherID: string) => {
      Logger.info(addName(`Remove ${watcherID}`))
      WatchersManager.watcherQueues[functionID].pop(watcherID)
      if (WatchersManager.watcherQueues[functionID].getLen() === 0) {
        delete WatchersManager.watcherQueues[functionID]
      }
    }

    const watcher = new Watcher({
      onShutdown,
      ...runRequest,
    })

    await watcher.start()
    if (WatchersManager.watcherQueues[functionID] == null) {
      WatchersManager.watcherQueues[functionID] = new WatcherQueue()
    }

    WatchersManager.watcherQueues[functionID].push(watcher)
    return WatchersManager.watcherQueues[functionID].getAvailable()
  }
}
