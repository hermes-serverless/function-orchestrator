import { NextFunction, Request, Response, Router } from 'express'
import { AuthDatasource } from '../datasources/AuthDatasource'
import { AuthenticationError } from '../datasources/Errors'

const authRouter = Router()

const handleRegisterUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const newUser = await AuthDatasource.register(req.body)
      res.status(200).send(newUser)
    } else {
      res.status(400).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

const handleGetMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      if (!req.headers['authorization']) {
        throw new AuthenticationError('Missing Authorization header')
      }
      const me = await AuthDatasource.getMe(req.headers['authorization'])
      res.status(200).send(me)
    } else {
      res.status(400).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}

const handleLoginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const token = await AuthDatasource.login(req.body)
      res.status(200).send(token)
    } else {
      res.status(400).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

const handleUserExistence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const response = await AuthDatasource.usernameExists(req.params.username)
      res.status(200).send(response)
    } else {
      res.status(400).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

authRouter.all('/register', handleRegisterUser)
authRouter.all('/register/:username', handleUserExistence)
authRouter.all('/me', handleGetMe)
authRouter.all('/login', handleLoginUser)

export { authRouter }
