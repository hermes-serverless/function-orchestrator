import axios, { AxiosInstance } from 'axios'
import { User, HermesFunction, HermesFunctionProto } from '../typings'
import { errorCheck, createErrorToCheck, SimpleError } from './Errors'

const commonErrors = [
  createErrorToCheck('NoSuchUser', new SimpleError('NoSuchUser')),
  createErrorToCheck('NoSuchFunction', new SimpleError('NoSuchFunction')),
]

export class FunctionDatasource {
  private static axios: AxiosInstance = axios.create({
    baseURL: 'http://db-manager:8080/user',
    timeout: 1000,
  })

  static async getFunctions(user: User, auth: string): Promise<HermesFunction> {
    try {
      const res = await this.axios.get(`/${user.username}/function`, {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async getFunction(
    user: User,
    functionName: string,
    auth: string
  ): Promise<HermesFunction> {
    try {
      const res = await this.axios.get(`/${user.username}/function/${functionName}`, {
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
    functionName: string,
    auth: string
  ): Promise<HermesFunction> {
    try {
      const res = await this.axios.delete(`/${user.username}/function/${functionName}`, {
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
  ): Promise<HermesFunction> {
    try {
      const res = await this.axios.post(`/${user.username}/function/`, newFunction, {
        headers: { Authorization: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }
}
