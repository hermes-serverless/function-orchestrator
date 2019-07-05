import axios, { AxiosInstance } from 'axios'
import { Readable } from 'stream'
import { Logger } from '../utils/Logger'
import { createErrorToCheck, errorCheck, SimpleError } from './Errors'

const commonErrors = [createErrorToCheck('NoSuchRun', new SimpleError('NoSuchRun'))]

interface RunStatus {
  status: string
  runError?: string
  startTime: string
  endTime?: string
  runningTime: string
  out: string
  err: string
}

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

  public async getRunStatusStream(runID: string): Promise<Readable> {
    try {
      const res = await this.axios.get(`/run/${runID}`, {
        responseType: 'stream',
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  public async getRunStatus(runID: string): Promise<RunStatus> {
    try {
      const res = await this.axios.get(`/run/${runID}`)
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  public async deleteRun(runID: string): Promise<any> {
    try {
      const res = await this.axios.delete(`/run/${runID}`)
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  public async getResultStream(runID: string): Promise<Readable> {
    try {
      const res = await this.axios.get(`/run/${runID}/result`, {
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
      Logger.info(`[WatcherDatasource ${this.watcherName}] Shutdown error\n`, errResponse)
    }
  }
}
