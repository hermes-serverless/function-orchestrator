import { RunDeleteObj, RunGetObj, RunPostObj, RunPutObj } from '@hermes-serverless/api-types-db-manager/run'
import axios, { AxiosInstance } from 'axios'
import { User } from '../typings'
import { RunProto } from '../typings.d'
import { createErrorToCheck, errorCheck, SimpleError, ValidationError } from './Errors'
import { FunctionID, PartialFunctionID } from './FunctionDatasource'

const commonErrors = [
  createErrorToCheck('NoSuchUser', new SimpleError('NoSuchUser')),
  createErrorToCheck('NoSuchFunction', new SimpleError('NoSuchFunction')),
  createErrorToCheck('NoSuchRun', new SimpleError('NoSuchRun')),
]

export interface PartialFunctionIDWithOwner extends PartialFunctionID {
  functionOwner: string
}

export interface FunctionIDWithOwner extends FunctionID {
  functionOwner: string
}

const createFunctionRunsUrl = (username: string, partialFunctionID: PartialFunctionIDWithOwner) => {
  const { functionOwner, functionName, functionVersion } = partialFunctionID
  return (
    `/${username}/function-runs/${functionOwner}` +
    (functionName ? `/${functionName}` + (functionVersion ? `/${functionVersion}` : '') : '')
  )
}

const createRunsUrl = (username: string, { id }: { id?: string }) => {
  return `/${username}/runs` + (id ? `/${id}` : '')
}

export class RunDatasource {
  private static axios: AxiosInstance = axios.create({
    baseURL: 'http://db-manager:8080/user',
    timeout: 1000,
  })

  static async getRun(user: User, runID: { id?: string }, auth: string): Promise<RunGetObj> {
    try {
      const res = await this.axios.get(createRunsUrl(user.username, runID), {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async deleteRun(user: User, runID: { id?: string }, auth: string): Promise<RunDeleteObj> {
    try {
      const res = await this.axios.delete(createRunsUrl(user.username, runID), {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async updateRun(user: User, runID: { id: string }, updatedRun: RunProto, auth: string): Promise<RunPutObj> {
    try {
      const res = await this.axios.put(createRunsUrl(user.username, runID), updatedRun, {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors, createErrorToCheck('ValidationError', new ValidationError())]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async getFunctionRun(user: User, functionID: PartialFunctionIDWithOwner, auth: string): Promise<RunGetObj> {
    try {
      const res = await this.axios.get(createFunctionRunsUrl(user.username, functionID), {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async deleteFunctionRun(
    user: User,
    functionID: PartialFunctionIDWithOwner,
    auth: string
  ): Promise<RunDeleteObj> {
    try {
      const res = await this.axios.delete(createFunctionRunsUrl(user.username, functionID), {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async createFunctionRun(
    user: User,
    functionID: FunctionIDWithOwner,
    newRun: RunProto,
    auth: string
  ): Promise<RunPostObj> {
    try {
      const res = await this.axios.post(createFunctionRunsUrl(user.username, functionID), newRun, {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors, createErrorToCheck('ValidationError', new ValidationError())]
      errorCheck(errResponse, possibleErrors)
    }
  }
}
