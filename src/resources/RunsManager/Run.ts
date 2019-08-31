import { RunData } from '@hermes-serverless/api-types-db-manager/run'
import { RunStatus } from '@hermes-serverless/api-types-function-watcher'
import { Waiter } from '@hermes-serverless/custom-promises'
import { createFsReadStream, createFsWriteStream } from '@hermes-serverless/fs-utils'
import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { PassThrough, pipeline } from 'stream'
import { promisify } from 'util'
import { RunDatasource } from '../../datasources'
import { FunctionDatasource } from '../../datasources/FunctionDatasource'
import { FunctionIDWithOwner } from '../../datasources/RunDatasource'
import { User } from '../../typings.d'
import { Logger } from '../../utils/Logger'
import { resultsBasePath } from './paths'
import { RunRequest, WatchersManager } from './WatchersManager'
import { Watcher } from './WatchersManager/Watcher'

interface UserInfo {
  user: User
}

export type RunToCreate = UserInfo & FunctionIDWithOwner
export type ExistingRun = UserInfo & { id: string }

export class Run {
  private id: string
  private user: User
  private data: RunData

  private finishedExecuting: boolean
  private done: Promise<any>
  private allFinishedWaiter: Waiter<any>
  private finishedTransferingResult: boolean

  private watcherResponsible: Watcher

  constructor() {
    this.allFinishedWaiter = new Waiter()
  }

  get runID() {
    return this.id
  }

  get allFinished() {
    return this.finishedExecuting && this.finishedTransferingResult
  }

  get allFinishedPromise() {
    return this.allFinishedWaiter.finish()
  }

  public resultOutputPath = () => {
    return path.join(resultsBasePath, `output-${this.id}`)
  }

  public resultInfoPath = () => {
    return path.join(resultsBasePath, `info-${this.id}`)
  }

  public resultOutput = () => {
    if (this.finishedTransferingResult) return createFsReadStream(this.resultOutputPath())
    return null
  }

  public resultInfo = async () => {
    if (this.finishedTransferingResult) {
      return JSON.parse(await fs.promises.readFile(this.resultInfoPath(), { encoding: 'utf-8' }))
    }
    return null
  }

  public init = async (run: RunToCreate | ExistingRun, token: string) => {
    const { user } = run
    this.user = user

    try {
      if ((run as ExistingRun).id) {
        const { id } = run as ExistingRun
        const { runs } = await RunDatasource.getRun(user, { id }, token)
        this.data = runs[0]
        this.finishedExecuting = this.finishedTransferingResult = true
        this.id = this.data.id.toString()
      } else {
        const { functionOwner, functionName, functionVersion } = run as RunToCreate
        const { createdRun } = await RunDatasource.createFunctionRun(
          user,
          { functionOwner, functionName, functionVersion },
          { status: 'running' },
          token
        )
        this.data = createdRun[0]
        this.finishedExecuting = this.finishedTransferingResult = false
        this.id = this.data.id.toString()
        Logger.info(this.addName(`Created run`))
      }
    } catch (err) {
      Logger.error(this.addName('Error on Run init'), err)
      throw err
    }
  }

  public getStatus = (additionalFields?: string[]) => {
    if (!this.finishedTransferingResult) {
      Logger.info(this.addName('Not finished transfering result, get status'))
      return this.watcherResponsible.getRunStatus(this.id, additionalFields)
    }

    Logger.info(this.addName('Finished transfering result, get result'))
    return this.resultInfo()
  }

  private createRunRequest = async (token: string): Promise<RunRequest> => {
    const fnID: FunctionIDWithOwner = {
      functionOwner: this.data.function.owner.username,
      functionName: this.data.function.functionName,
      functionVersion: this.data.function.functionVersion,
    }

    const { functions } = await FunctionDatasource.getFunction(this.user, fnID, token)
    const { id: functionID, imageName, gpuCapable } = functions[0]
    return { functionID, imageName, gpuCapable }
  }

  public startRun = async (req: Request, res: Response, token: string, runType: 'async' | 'sync') => {
    try {
      const runRequest = await this.createRunRequest(token)
      Logger.info(this.addName(`Got function`))
      this.watcherResponsible = await WatchersManager.getAvailableWatcher(runRequest)
      Logger.info(this.addName(`Got watcher`))
      this.done = this.watcherResponsible.run(req, res, this.data.id, runType)
      this.done.then(
        () => {
          Logger.info(this.addName('Finished executing, start transfer'))
          this.finishedExecuting = true
          this.transferResult()
        },
        err => this.onStartError(token, err)
      )
    } catch (err) {
      await this.onStartError(token, err)
    }
  }

  private onStartError = async (token: string, err: Error) => {
    Logger.error(this.addName('Error starting run'), err)
    try {
      const { updatedRuns } = await RunDatasource.updateRun(
        this.user,
        { id: this.data.id.toString() },
        { status: 'error' },
        token
      )

      this.data = updatedRuns[0]
    } catch (err) {
      Logger.error(this.addName(`Error updating run`), err)
    }

    fs.writeFileSync(this.resultOutputPath(), '')
    const status: RunStatus = { status: 'error', error: `${err.constructor.name} - ${err.message}` }
    fs.writeFileSync(this.resultInfoPath(), JSON.stringify(status))
    this.finishedExecuting = true
    this.finishedTransferingResult = true
    this.allFinishedWaiter.reject(err)
  }

  private transferResult = async () => {
    try {
      const resultInfoJson = await this.watcherResponsible.getResultInfo(this.id)
      await this.persistResult(resultInfoJson)
      Logger.info(this.addName(`Start result transfering`))

      const resultInfo = new PassThrough()
      resultInfo.end(JSON.stringify(resultInfoJson))
      const resultInfoFile = await createFsWriteStream(this.resultInfoPath())

      const resultOutput = await this.watcherResponsible.getResultOutput(this.id)
      const resultOutputFile = await createFsWriteStream(this.resultOutputPath())

      const promisifiedPipeline = promisify(pipeline)
      await promisifiedPipeline([resultInfo, resultInfoFile])
      await promisifiedPipeline([resultOutput, resultOutputFile])

      this.finishedTransferingResult = true
      this.allFinishedWaiter.resolve()
      Logger.info(this.addName(`End transfer result`))
      this.watcherResponsible.deleteRunData(this.id)
      this.watcherResponsible.shutdown()
    } catch (err) {
      this.allFinishedWaiter.reject(err)
      Logger.error(this.addName(`Error transfering result`), err)
    }
  }

  private persistResult = async (resultInfo: RunStatus) => {
    try {
      const { status, startTime, endTime } = resultInfo
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

  private addName = (msg: string) => {
    return `[Run ${this.id}] ${msg}`
  }
}
