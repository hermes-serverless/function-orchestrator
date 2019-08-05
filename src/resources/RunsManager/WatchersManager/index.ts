import { WatcherQueue } from './WatcherQueue'

interface WatcherQueues {
  [key: string]: WatcherQueue
}

export interface RunRequest {
  imageName: string
  gpuCapable: boolean
  functionID: string
}

export class WatchersManager {
  private static watcherQueues: WatcherQueues = {}

  public static getAvailableWatcher = (runRequest: RunRequest) => {
    const { functionID } = runRequest
    if (WatchersManager.watcherQueues[functionID] == null) {
      WatchersManager.watcherQueues[functionID] = new WatcherQueue(runRequest, () => {
        delete WatchersManager.watcherQueues[functionID]
      })
    }
    return WatchersManager.watcherQueues[functionID].getWatcher()
  }
}
