import { AxiosError } from 'axios'
import { DbManagerErrorResponse } from '../typings'

export interface ErrorToCheck {
  name: string
  error: RouteError
}

export const createErrorToCheck = (name: string, error: RouteError) => {
  return {
    name,
    error,
  }
}

export const errorCheck = (axiosError: AxiosError, errorsToCheck: ErrorToCheck[]) => {
  const err: DbManagerErrorResponse = axiosError.response.data
  const errMatch = errorsToCheck.filter(el => err.error === el.name)
  if (errMatch.length === 0) throw new InternalServerError()
  errMatch[0].error.configure(err, axiosError.response.status)
  throw errMatch[0].error
}

interface ObjectWithKeys {
  [key: string]: any
}

export interface RouteErrorConstructorArgs {
  errorName: string
  message: string
  statusCode: number
  detail?: ObjectWithKeys
}

export interface RouteErrorSetArgs {
  errorName?: string
  message?: string
  statusCode?: number
  detail?: ObjectWithKeys
}

export class RouteError extends Error {
  private msg: string
  private errorName: string
  private statusCode: number
  private detail: any

  constructor({ errorName, message, statusCode, detail }: RouteErrorConstructorArgs) {
    super(message)
    this.msg = message
    this.statusCode = statusCode
    this.errorName = errorName
    if (detail != null) this.detail = detail
  }

  getResponseObject() {
    return {
      error: this.errorName,
      message: this.msg,
      ...(this.detail != null ? { detail: this.detail } : {}),
    }
  }

  getStatusCode() {
    return this.statusCode
  }

  setArgs({ errorName, message, statusCode, detail }: RouteErrorSetArgs) {
    if (errorName != null) this.errorName = errorName
    if (message != null) this.msg = message
    if (statusCode != null) this.statusCode = statusCode
    if (detail != null) this.detail = detail
  }

  configure(dbResponse: DbManagerErrorResponse, statusCode: number) {}
}

export class SimpleError extends RouteError {
  constructor(errorName: string) {
    super({
      errorName,
      message: '',
      statusCode: 500,
    })
  }

  configure(dbResponse: DbManagerErrorResponse, statusCode: number) {
    this.setArgs({
      statusCode,
      message: dbResponse.message,
    })
  }
}

export class AuthenticationError extends RouteError {
  constructor(message?: string) {
    super({
      errorName: 'AuthenticationError',
      message: message || 'Authentication error',
      statusCode: 401,
    })
  }

  configure(dbResponse: DbManagerErrorResponse, statusCode: number) {
    this.setArgs({
      statusCode,
      message: dbResponse.message,
    })
  }
}

export class InvalidRequestArguments extends RouteError {
  constructor(message?: string) {
    super({
      errorName: 'InvalidArguments',
      message: message || 'Some arguments for the request were invalid or missing',
      statusCode: 400,
    })
  }

  configure(dbResponse: DbManagerErrorResponse, statusCode: number) {
    this.setArgs({
      statusCode,
      message: dbResponse.message,
    })
  }
}

export class InternalServerError extends RouteError {
  constructor() {
    super({
      errorName: 'InternalServerError',
      message: 'Something broke in the server',
      statusCode: 500,
    })
  }
}

export class ValidationError extends RouteError {
  constructor(message?: string) {
    super({
      errorName: 'ValidationError',
      message: message || 'Some fields were invalid',
      statusCode: 400,
    })
  }

  configure(dbResponse: DbManagerErrorResponse, statusCode: number) {
    this.setArgs({
      statusCode,
      detail: dbResponse.detail,
    })
  }
}
