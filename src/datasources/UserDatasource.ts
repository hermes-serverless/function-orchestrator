import axios, { AxiosInstance } from 'axios'
import { User } from '../typings'
import { DeletedUser, UpdatedUser } from './../typings'
import { createErrorToCheck, errorCheck, SimpleError, ValidationError } from './Errors'

const commonErrors = [createErrorToCheck('NoSuchUser', new SimpleError('NoSuchUser'))]

export class UserDatasource {
  private static axios: AxiosInstance = axios.create({
    baseURL: 'http://db-manager:8080/user',
    timeout: 1000,
  })

  static async deleteUser(user: User, auth: string): Promise<DeletedUser> {
    try {
      const res = await this.axios.delete(`/${user.username}`, {
        headers: { Authentication: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [...commonErrors]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async updateUser(user: User, updatedUser: User, auth: string): Promise<UpdatedUser> {
    try {
      const res = await this.axios.put(`/${user.username}`, updatedUser, {
        headers: { Authentication: auth },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [
        ...commonErrors,
        createErrorToCheck('ValidationError', new ValidationError()),
        createErrorToCheck('UserAlreadyExists', new SimpleError('UserAlreadyExists')),
      ]
      errorCheck(errResponse, possibleErrors)
    }
  }
}
