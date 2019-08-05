import { Waiter } from '@hermes-serverless/custom-promises'
import { randomBytes } from 'crypto'
import { Request, Response } from 'express'
import { MAX_WATCHER_IDLE_TIME } from '../../../limits'
import { ResettableTimer } from '../../../utils/ResettableTimer'
import { DockerContainer } from '../../DockerInterface/DockerContainer'
import { Proxy, ReqChanger } from '../../ProxyServer'
import { RedisWrapper } from '../../RedisWrapper'
import { WatcherDatasource } from './../../../datasources/WatcherDatasource'
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
  private baseURL: string

  private runs: number

  private timer: ResettableTimer
  private onShutdown: CallbackFn
  private canShutdown: boolean
  private switchedOn: boolean

  constructor(watcherRequest: WatcherRequest) {
    const { imageName, gpuCapable, functionID, onShutdown } = watcherRequest
    this.runs = 0

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

    this.canShutdown = false
    this.switchedOn = false
    this.onShutdown = onShutdown
    this.timer = new ResettableTimer(MAX_WATCHER_IDLE_TIME, this.shutdown)
    this.baseURL = `http://${this.watcherName}:3000/`
  }

  get watcherID() {
    return this.id
  }

  get canAcceptNewRuns() {
    return this.runs === 0 && this.switchedOn
  }

  public deleteRunData = (runID: string) => {
    Logger.info(this.addName(`Delete run result ${runID}`))
    return this.datasource.deleteRun(runID)
  }

  public getRunStatus = (runID: string, additionalFields?: string[]) => {
    return this.datasource.getRunStatus(runID, additionalFields)
  }

  public getResultInfo = (runID: string) => {
    return this.datasource.getResultInfo(runID)
  }

  public getResultOutput = (runID: string) => {
    return this.datasource.getResultOutput(runID)
  }

  public start = async () => {
    const containerWaiter = new Waiter()

    const listenerID = randomBytes(8).toString('hex')
    RedisWrapper.addSubscription(this.watcherName, listenerID, (channel, message) => {
      if (message.indexOf('STARTUP-SUCCESS') !== -1) {
        Logger.info(this.addName(`Watcher container for functionId(${this.functionID}) successfully deployed`))
        RedisWrapper.removeSubscription(this.watcherName, listenerID)
        containerWaiter.resolve()
      } else if (message === 'STARTUP-ERROR') {
        Logger.error(this.addName(`Error deploying container for functionId(${this.functionID})`))
        RedisWrapper.removeSubscription(this.watcherName, listenerID)
        containerWaiter.reject(new WatcherStartupError('Watcher startup error'))
      }
    })

    try {
      await this.container.start()
    } catch (err) {
      Logger.error(this.addName(`Docker process error`), err)
      RedisWrapper.removeSubscription(this.watcherName, listenerID)
      throw new WatcherStartupError('Watcher startup error')
    }

    await containerWaiter.finish()
    this.canShutdown = true
    this.switchedOn = true
    this.timer.start()
    return this.watcherName
  }

  public shutdown = () => {
    if (!this.canShutdown) return
    this.switchedOn = false
    this.onShutdown(this.id)
    Logger.info(this.addName('Shutdown'))
    return this.datasource.shutdown()
  }

  public run = (req: Request, res: Response, runID: string, runType: 'async' | 'sync') => {
    this.canShutdown = false
    this.timer.stop()
    Logger.info(this.addName(`canShutdown = false`))
    const endpoint = this.baseURL + `run/${runType}`
    Logger.info(this.addName('run'), { endpoint, id: this.id })

    const done = new Waiter()

    const finallyCb = () => {
      this.canShutdown = true
      Logger.info(this.addName(`canShutdown = true`))
      this.timer.start()
      Logger.info(this.addName(`Done runs: ${this.runs}`))
    }

    done.then(finallyCb, finallyCb)

    const listenerID = randomBytes(8).toString('hex')
    RedisWrapper.addSubscription(this.watcherName, listenerID, (channel, message) => {
      if (message === `RUN-DONE ${runID}`) {
        Logger.info(this.addName(`Run ${runID} for functionId(${this.functionID}) done`))
        RedisWrapper.removeSubscription(this.watcherName, listenerID)
        done.resolve()
      }
    })

    this.runs += 1
    Logger.info(this.addName(`Will redirect - runs: ${this.runs}`))

    const onError = (err: any) => {
      Logger.error(this.addName(`Error redirecting - runs: ${this.runs}`), err)
      done.reject(err)
    }

    const reqChanger: ReqChanger = proxyReq => {
      proxyReq.setHeader('x-run-id', runID)
    }

    Proxy.redirect(req, res, endpoint, reqChanger, onError)
    return done.finish()
  }

  private addName = (msg: string) => {
    return `[Watcher ${this.watcherName}] ${msg}`
  }
}
