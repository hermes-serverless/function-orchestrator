import { Logger } from './../../utils/Logger'
import { DockerContainer } from '../DockerInterface/DockerContainer'
import { WatcherQueue } from './WatcherQueue'
import { RedisSubscribe } from '../RedisSubscribe'

interface RunRequest {
  lang: string
  username: string
  functionName: string
  gpuCapable: boolean
}

interface WatcherQueues {
  [key: string]: WatcherQueue
}

const getFunctionImageName = (runRequest: RunRequest) => {
  return (
    runRequest.username.toLowerCase() + '/' + runRequest.functionName.toLowerCase() + '_watcher'
  )
}

class WatchersManager {
  static watcherQueues: WatcherQueues = {}

  public static run = async (runRequest: RunRequest, doProxy: any) => {
    const fName = getFunctionImageName(runRequest)
    if (!WatchersManager.watcherQueues[fName]) {
      WatchersManager.watcherQueues[fName] = new WatcherQueue(fName)
    }

    let tries = 2
    while (tries > 0) {
      try {
        console.log(`TRIES ${tries}/2`)
        const endpoint = WatchersManager.watcherQueues[fName].pop() + '/execute'
        Logger.info('[WatchersManager] run', { functionName: fName, endpoint })
        await doProxy(endpoint)
        WatchersManager.watcherQueues[fName].push(endpoint)
      } catch (e) {
        console.log(e)
        await WatchersManager.deployWatcher(runRequest)
      }
      tries -= 1
    }
  }

  private static deployWatcher = async (runRequest: RunRequest) => {
    const fName = getFunctionImageName(runRequest)

    let containerIsValid: any, containerError: any
    const isContainerValid = new Promise((resolve, reject) => {
      containerIsValid = resolve
      containerError = reject
    })

    const dnsName = RedisSubscribe.addSubscription((channel, message) => {
      console.log(`Channel: ${channel} Message: ${message}`)
      if (message === 'OK') {
        Logger.info(`Container for ${fName} successfully deployed`)
        containerIsValid()
      } else {
        Logger.error(`Error deploying container for ${fName}`)
        containerError()
      }
    })

    Logger.info(`Container dnsName`, { dnsName })

    const container = new DockerContainer({
      imageName: fName,
      gpuCapable: runRequest.gpuCapable,
      port: 3000,
      dnsName,
      detach: true,
      network: 'hermes',
      envVariables: [`REDIS_CHANNEL=${dnsName}`],
    })

    container.run()

    try {
      console.log('Waiting for container')
      await isContainerValid
      console.log('WOLOLOOO')
      WatchersManager.watcherQueues[fName].push(dnsName)
    } catch (e) {
      console.log(e)
      console.log('DEU RUIM NO DEPLOY')
    }
  }
}

export { WatchersManager }
