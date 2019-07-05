import axios, { AxiosInstance } from 'axios'
import { User, HermesFunction, HermesFunctionProto } from '../typings'
import { errorCheck, createErrorToCheck, SimpleError, ValidationError } from './Errors'

const commonErrors = [
  createErrorToCheck('NoSuchUser', new SimpleError('NoSuchUser')),
  createErrorToCheck('NoSuchFunction', new SimpleError('NoSuchFunction')),
]

interface BaseFunctionObj {
  id: string
  ownerId: string
  functionName: string
  gpuCapable: boolean
  scope: string
  imageName: string
  functionVersion: string
}

interface FunctionGetObj {
  functions: BaseFunctionObj[]
}

interface FunctionDeleteObj {
  deletedFunctions: BaseFunctionObj[]
}

interface FunctionPostObj {
  newFunction: BaseFunctionObj[]
}

interface FunctionPutObj {
  updatedFunctions: BaseFunctionObj[]
}

export interface PartialFunctionID {
  functionName?: string
  functionVersion?: string
}

export interface FunctionID {
  functionName: string
  functionVersion: string
}

const createUrl = (username: string, partialFunctionID: PartialFunctionID) => {
  const { functionName, functionVersion } = partialFunctionID
  return (
    `/${username}/function` +
    (functionName ? `/${functionName}` + (functionVersion ? `/${functionVersion}` : '') : '')
  )
}

export class FunctionDatasource {
  private static axios: AxiosInstance = axios.create({
    baseURL: 'http://db-manager:8080/user',
    timeout: 1000,
  })

  static async getFunction(
    user: User,
    partialFunctionID: PartialFunctionID,
    auth: string
  ): Promise<FunctionGetObj> {
    try {
      const res = await this.axios.get(createUrl(user.username, partialFunctionID), {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async deleteFunction(
    user: User,
    partialFunctionID: PartialFunctionID,
    auth: string
  ): Promise<FunctionDeleteObj> {
    try {
      const res = await this.axios.delete(createUrl(user.username, partialFunctionID), {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async createFunction(
    user: User,
    newFunction: HermesFunctionProto,
    auth: string
  ): Promise<FunctionPostObj> {
    try {
      const res = await this.axios.post(`/${user.username}/function/`, newFunction, {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [
        ...commonErrors,
        createErrorToCheck('ValidationError', new ValidationError()),
        createErrorToCheck('FunctionAlreadyExists', new SimpleError('FunctionAlreadyExists')),
      ]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async updateFunction(
    user: User,
    functionID: FunctionID,
    updatedFunction: HermesFunctionProto,
    auth: string
  ): Promise<FunctionPutObj> {
    try {
      const res = await this.axios.put(createUrl(user.username, functionID), updatedFunction, {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [
        ...commonErrors,
        createErrorToCheck('ValidationError', new ValidationError()),
        createErrorToCheck('FunctionAlreadyExists', new SimpleError('FunctionAlreadyExists')),
      ]
      errorCheck(errResponse, possibleErrors)
    }
  }
}
