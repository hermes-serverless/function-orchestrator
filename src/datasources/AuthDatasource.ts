import axios, { AxiosInstance } from 'axios'
import { AuthResponse, User, UserForAuth } from '../typings'
import { UsernameExistsObj } from './../typings.d'
import {
  AuthenticationError,
  createErrorToCheck,
  errorCheck,
  InvalidRequestArguments,
  SimpleError,
  ValidationError,
} from './Errors'

export class AuthDatasource {
  private static axios: AxiosInstance = axios.create({
    baseURL: 'http://db-manager:8080/auth',
    timeout: 1000,
  })

  static async login(user: UserForAuth): Promise<AuthResponse> {
    try {
      const res = await this.axios.post('/login', user)
      return res.data
    } catch (errResponse) {
      const possibleErrors = [
        createErrorToCheck('AuthenticationError', new AuthenticationError()),
        createErrorToCheck('MissingArgument', new InvalidRequestArguments()),
      ]

      errorCheck(errResponse, possibleErrors)
    }
  }

  static async usernameExists(username: string): Promise<UsernameExistsObj> {
    try {
      const res = await this.axios.post(`/register/${username}`)
      return res.data
    } catch (errResponse) {
      errorCheck(errResponse, [])
    }
  }

  static async register(newUser: UserForAuth): Promise<AuthResponse> {
    try {
      const res = await this.axios.post('/register', newUser)
      return res.data
    } catch (errResponse) {
      const possibleErrors = [
        createErrorToCheck('MissingArgument', new InvalidRequestArguments()),
        createErrorToCheck('ValidationError', new ValidationError()),
        createErrorToCheck('UserAlreadyExists', new SimpleError('UserAlreadyExists')),
      ]
      errorCheck(errResponse, possibleErrors)
    }
  }

  static async getMe(authorization: string): Promise<User> {
    try {
      const res = await this.axios.get('/me', {
        headers: { Authorization: authorization },
      })
      return res.data
    } catch (errResponse) {
      const possibleErrors = [createErrorToCheck('AuthenticationError', new AuthenticationError())]
      errorCheck(errResponse, possibleErrors)
    }
  }
}
