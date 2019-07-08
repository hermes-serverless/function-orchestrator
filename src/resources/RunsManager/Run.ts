import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { Readable, Writable } from 'stream'
import { RunDatasource } from '../../datasources'
import { Logger } from '../../utils/Logger'
import { FunctionDatasource } from './../../datasources/FunctionDatasource'
import { BaseRunObj, FunctionIDWithOwner } from './../../datasources/RunDatasource'
import { User } from './../../typings.d'
import { Waiter } from './../../utils/CustomPromises'
import { WatchersManager } from './WatchersManager'
import { Watcher } from './WatchersManager/Watcher'

interface UserInfo {
  user: User
}

export type RunToCreate = UserInfo & FunctionIDWithOwner
export type ExistingRun = UserInfo & { id: string }

export class Run {
  private id: string
  private user: User
  private data: BaseRunObj
  private fnID: FunctionIDWithOwner

  private ready: Waiter<void>

  private doneExecuting: boolean
  private donePromise: Promise<any>
  private finishedTransferingResult: boolean

  private watcherResponsible: Watcher

  constructor(run: RunToCreate | ExistingRun, token: string) {
    this.ready = new Waiter()
    const { user } = run
    this.user = user

    const start = async () => {
      try {
        if ((run as ExistingRun).id) {
          const { id } = run as ExistingRun
          const { runs } = await RunDatasource.getRun(user, { id }, token)
          this.data = runs[0]
          this.doneExecuting = this.finishedTransferingResult = true
        } else {
          const { functionOwner, functionName, functionVersion } = run as RunToCreate
          this.fnID = {
            functionOwner,
            functionName,
            functionVersion,
          }

          const { createdRun } = await RunDatasource.createFunctionRun(
            user,
            this.fnID,
            { status: 'running' },
            token
          )
          this.data = createdRun[0]
          this.doneExecuting = this.finishedTransferingResult = false
          Logger.info(this.addName(`Created run`))
        }

        this.id = this.data.id.toString()
        this.ready.resolve()
      } catch (err) {
        Logger.error(this.addName('Error on Run init'), err)
        this.ready.reject(err)
      }
    }

    start()
  }

  public isReady = () => {
    return this.ready.finish()
  }

  public getID = () => {
    return this.id
  }

  public getStatus = async () => {
    await this.ready.finish()

    if (!this.finishedTransferingResult) {
      Logger.info(this.addName('Not finished transfering result, get status'))
      return this.watcherResponsible.getRunStatusStream(this.id)
    }

    Logger.info(this.addName('Finished transfering result, get result'))
    return this.getResultReadStream()
  }

  public getResult = async () => {
    await this.ready.finish()
    if (this.finishedTransferingResult) return this.getResultReadStream()
    return null
  }

  public startRun = async (req: Request, res: Response, token: string, user: User) => {
    if (this.doneExecuting) return
    await this.ready.finish()

    try {
      const { functions } = await FunctionDatasource.getFunction(user, this.fnID, token)
      const { id: functionID, imageName, gpuCapable } = functions[0]
      Logger.info(this.addName(`Got function`))
      this.watcherResponsible = WatchersManager.getAvailableWatcher(functionID)
      if (this.watcherResponsible == null) {
        Logger.info(this.addName(`Has to create watcher`))
        this.watcherResponsible = await WatchersManager.createWatcher({
          functionID,
          imageName,
          gpuCapable,
        })
      }
      Logger.info(this.addName(`Got watcher`))
      this.donePromise = this.watcherResponsible.run(req, res, this.data.id.toString())
      this.donePromise.then(() => {
        this.doneExecuting = true
        this.transferResult()
      })
    } catch (err) {
      Logger.error(this.addName('Error starting run'), err)
      const { updatedRuns } = await RunDatasource.updateRun(
        user,
        { id: this.data.id.toString() },
        { status: 'error' },
        token
      )
      this.data = updatedRuns[0]
    }
  }

  public allFinished = () => {
    return this.doneExecuting && this.finishedTransferingResult
  }

  private transferResult = async () => {
    try {
      await this.persistResult()
      Logger.info(this.addName(`Start transfer result`))
      const out = await this.getResultWriteStream()
      const file = await this.watcherResponsible.getRunResult(this.id)

      const transferWaiter = new Waiter()
      out.on('error', transferWaiter.reject)
      file.on('error', transferWaiter.reject)
      out.on('close', transferWaiter.resolve)
      file.pipe(out)
      await transferWaiter.finish()
      this.finishedTransferingResult = true
      Logger.info(this.addName(`End transfer result`))
      this.watcherResponsible.deleteRunResult(this.id)
    } catch (err) {
      Logger.error(this.addName(`Error transfering result`), err)
    }
  }

  private persistResult = async () => {
    try {
      const runInfo = await this.watcherResponsible.getRunStatus(this.id)
      const { status, startTime, endTime } = runInfo
      await RunDatasource.updateRun(
        this.user,
        { id: this.id },
        {
          status,
          startTime: new Date(startTime),
          endTime: new Date(endTime!),
        },
        ''
      )
    } catch (err) {
      Logger.error(this.addName('Error updating status on db'), err)
    }
  }

  private getResultWriteStream = (): Promise<Writable> => {
    const stream = fs.createWriteStream(`/app/results/${this.id}`, { flags: 'wx' })
    const streamReady: Waiter<Writable> = new Waiter()
    stream.on('open', () => streamReady.resolve(stream))
    stream.on('error', streamReady.reject)
    return streamReady.finish()
  }

  private getResultReadStream = async (): Promise<Readable> => {
    const stream = fs.createReadStream(this.getResultPath())
    const streamReady: Waiter<Readable> = new Waiter()
    stream.on('open', () => streamReady.resolve(stream))
    stream.on('error', streamReady.reject)
    return streamReady.finish()
  }

  private getResultPath = () => {
    return path.join('/', 'app', 'results', `${this.id}`)
  }

  private addName = (msg: string) => {
    return `[Run ${this.id}] ${msg}`
  }
}
