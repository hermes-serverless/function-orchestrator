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

export interface UserForAuth {
  username: string
  password: string
}
