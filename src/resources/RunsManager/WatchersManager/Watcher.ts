import { randomBytes } from 'crypto'
import { Request, Response } from 'express'
import { DockerContainer } from '../../DockerInterface/DockerContainer'
import { Proxy } from '../../ProxyServer'
import { RedisWrapper } from '../../RedisWrapper'
import { WatcherDatasource } from './../../../datasources/WatcherDatasource'
import { MAX_WATCHER_IDLE_TIME } from './../../../limits/'
import { Waiter } from './../../../utils/CustomPromises'
import { Logger } from './../../../utils/Logger'

class WatcherStartupError extends Error {
  constructor(msg?: string) {
    super(msg)
  }
}

type CallbackFn = (watcherID: string) => void

export interface WatcherRequest {
  imageName: string
  gpuCapable: boolean
  functionID: string
  onShutdown: CallbackFn
}

export class Watcher {
  private id: string
  private container: DockerContainer
  private watcherName: string
  private functionID: string
  private datasource: WatcherDatasource

  private curRuns: number
  private maxParallelRuns: number

  private timer: NodeJS.Timeout
  private onShutdown: CallbackFn
  private canShutdown: boolean

  constructor(watcherRequest: WatcherRequest) {
    const { imageName, gpuCapable, functionID, onShutdown } = watcherRequest
    this.curRuns = 0

    this.id = randomBytes(8).toString('hex')
    this.functionID = functionID
    this.watcherName = `watcher-${functionID}_${this.id}`
    this.datasource = new WatcherDatasource(this.watcherName)
    this.container = new DockerContainer(this.id, {
      imageName,
      gpuCapable,
      port: 3000,
      dnsName: this.watcherName,
      detach: true,
      network: 'hermes',
      envVariables: [`REDIS_CHANNEL=${this.watcherName}`],
    })

    this.canShutdown = true
    this.onShutdown = onShutdown
  }

  public getID = () => {
    return this.id
  }

  public start = async () => {
    const containerWaiter = new Waiter()

    const listenerID = randomBytes(8).toString('hex')
    RedisWrapper.addSubscription(this.watcherName, listenerID, (channel, message) => {
      if (message.indexOf('STARTUP-SUCCESS') !== -1) {
        const maxParallelRunsReg = /\[([0-9]+)\]/g
        const match = maxParallelRunsReg.exec(message)
        this.maxParallelRuns = parseInt(match[1], 10)
        Logger.info(
          this.addName(
            `Watcher container for functionId(${this.functionID}) successfully deployed. Max parallel runs ${this.maxParallelRuns}`
          )
        )
        RedisWrapper.removeSubscription(this.watcherName, listenerID)
        containerWaiter.resolve()
      } else if (message === 'STARTUP-ERROR') {
        Logger.error(this.addName(`Error deploying container for functionId(${this.functionID})`))
        RedisWrapper.removeSubscription(this.watcherName, listenerID)
        containerWaiter.reject(new WatcherStartupError('Watcher startup error'))
      }
    })

    this.container.start({})
    await this.container.finish()
    if (this.container.getError() != null) {
      Logger.error(this.addName('Startup error'), this.container.getErr())
      RedisWrapper.removeSubscription(this.watcherName, listenerID)
      throw new WatcherStartupError('Watcher startup error')
    }

    await containerWaiter.finish()
    this.startTimer()
    return this.watcherName
  }

  public run = (req: Request, res: Response, runID: string) => {
    this.canShutdown = false
    this.stopTimer()
    Logger.info(this.addName(`canShutdown = false`))

    const endpoint = `http://${this.watcherName}:3000/run/${runID}`
    Logger.info(this.addName('run'), { endpoint, id: this.id })

    const done = new Waiter()

    done.then(() => {
      this.curRuns -= 1
      if (this.curRuns === 0) {
        this.canShutdown = true
        Logger.info(this.addName(`canShutdown = true`))
        this.startTimer()
      }
      Logger.info(this.addName(`Done CurRuns: ${this.curRuns}/${this.maxParallelRuns}`))
    })

    const listenerID = randomBytes(8).toString('hex')
    RedisWrapper.addSubscription(this.watcherName, listenerID, (channel, message) => {
      if (message === `RUN-DONE ${runID}`) {
        Logger.info(this.addName(`Run ${runID} for functionId(${this.functionID}) done`))
        RedisWrapper.removeSubscription(this.watcherName, listenerID)
        done.resolve()
      }
    })

    this.curRuns += 1
    Logger.info(this.addName(`Will redirect CurRuns: ${this.curRuns}/${this.maxParallelRuns}`))
    Proxy.redirect(req, res, endpoint, err => {
      Logger.error(
        this.addName(`Error redirecting CurRuns: ${this.curRuns}/${this.maxParallelRuns}`),
        err
      )
      done.reject(err)
    })

    return done.finish()
  }

  public getRunStatusStream = (runID: string) => {
    return this.datasource.getRunStatusStream(runID)
  }

  public getRunStatus = (runID: string) => {
    return this.datasource.getRunStatus(runID)
  }

  public getRunResult = (runID: string) => {
    return this.datasource.getResultStream(runID)
  }

  public deleteRunResult = (runID: string) => {
    Logger.info(this.addName(`Delete run result ${runID}`))
    return this.datasource.deleteRun(runID)
  }

  public shutdown = () => {
    if (!this.canShutdown) return
    this.stopTimer()
    this.onShutdown(this.id)
    Logger.info(this.addName('Shutdown'))
    return this.datasource.shutdown()
  }

  public stopTimer = () => {
    clearTimeout(this.timer)
    Logger.info(this.addName('Delete timer'))
  }

  public startTimer = () => {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(this.shutdown, MAX_WATCHER_IDLE_TIME)
    Logger.info(this.addName('Start timer'))
  }

  public resetTimer = () => {
    this.stopTimer()
    this.startTimer()
  }

  public canAcceptNewRuns = () => {
    return this.curRuns < this.maxParallelRuns
  }

  private addName = (msg: string) => {
    return `[Watcher ${this.watcherName}] ${msg}`
  }
}
