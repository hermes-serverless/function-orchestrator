import { Request } from 'express'

interface DetailObject {
  [key: string]: string
}

export interface DbManagerErrorResponse {
  error: string
  message: string
  detail?: DetailObject
}

export interface UsernameExistsObj {
  username: string
  exists: boolean
}

export interface AuthResponse {
  auth: boolean | null
  token: string
}

export interface User {
  id: string
  username: string
}

export interface UpdatedUser {
  updatedUser: User
}
export interface DeletedUser {
  deletedUser: User
}

export interface HermesFunctionProto {
  functionName: string
  language: string
  gpuCapable: boolean
  scope: string
  imageName: string
  functionVersion: string
}

export interface HermesFunction extends HermesFunctionProto {
  id: number
  ownerId: number
}

export interface RunProto {
  startTime?: Date
  endTime?: Date
  status: string
  outputPath?: string
  watcherId?: string
}

export interface RunData extends RunProto {
  id: number
  functionId: number
  userId: number
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
