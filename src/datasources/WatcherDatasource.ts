import { DeletedRun, ResultInfo, ResultOutput, RunStatus } from '@hermes-serverless/api-types-function-watcher'
import axios, { AxiosInstance } from 'axios'
import queryString from 'querystring'
import { Logger } from '../utils/Logger'
import { createErrorToCheck, errorCheck, SimpleError } from './Errors'

const commonErrors = [createErrorToCheck('NoSuchRun', new SimpleError('NoSuchRun'))]

export class WatcherDatasource {
  private axios: AxiosInstance
  private watcherName: string

  constructor(watcherName: string) {
    this.watcherName = watcherName
    this.axios = axios.create({
      baseURL: `http://${watcherName}:3000/`,
      timeout: 1000,
    })
  }

  public async getRunStatus(runID: string, additionalFields?: string[]): Promise<RunStatus> {
    try {
      const url = `/run/${runID}/status?` + queryString.encode({ ...(additionalFields || []) })
      Logger.info('URL', { url })
      const res = await this.axios.get(url)
      return res.data
    } catch (errResponse) {
      Logger.error(this.addName(`${errResponse.config.method} - ${errResponse.config.url}`), errResponse)
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  public async deleteRun(runID: string): Promise<DeletedRun> {
    try {
      const res = await this.axios.delete(`/run/${runID}/delete`)
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  public async getResultInfo(runID: string): Promise<ResultInfo> {
    try {
      const res = await this.axios.get(`/run/${runID}/result/info`)

      return res.data
    } catch (errResponse) {
      throw errResponse
    }
  }

  public async getResultOutput(runID: string): Promise<ResultOutput> {
    try {
      const res = await this.axios.get(`/run/${runID}/result/output`, {
        responseType: 'stream',
      })

      return res.data
    } catch (errResponse) {
      throw errResponse
    }
  }

  public async shutdown() {
    try {
      await this.axios.get(`/shutdown`)
    } catch (errResponse) {
      Logger.info(this.addName(`Shutdown error\n`), errResponse)
    }
  }

  public addName(msg: string) {
    return `[WatcherDatasource ${this.watcherName}] ${msg}`
  }
}
