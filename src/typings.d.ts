import { Request } from 'express'

interface DetailObject {
  [key: string]: string
}

export interface DbManagerErrorResponse {
  error: string
  message: string
  detail?: DetailObject
}

export interface AuthResponse {
  auth: boolean | null
  token?: string
}

export interface User {
  id: number
  username: string
}

export interface HermesFunctionProto {
  functionName: string
  language: string
  gpuCapable: boolean
  scope: string
  imageUrl: string
  functionVersion: string
}

export interface HermesFunction extends HermesFunctionProto {
  id: number
  ownerUserId: number
}

export interface UserUpdate {
  username: string
}

export interface UserForAuth {
  username: string
  password: string
}

export interface AuthenticatedReq extends Request {
  auth: {
    token: string
    user: User
  }
}
