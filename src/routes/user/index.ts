import { Logger } from '../../utils/Logger'
import { Router, Response, NextFunction } from 'express'
import { AuthDatasource } from '../../datasources/AuthDatasource'
import { AuthenticationError } from '../../datasources/Errors'
import { AuthenticatedReq } from '../../typings'
import { userHandler } from './userHandlers'
import { allFunctionsHandler, oneFunctionHandler, functionRunHandler } from './functionHandlers'

const validateAuthentication = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    if (!req.headers['authorization']) throw new AuthenticationError('Missing Authorization header')
    const me = await AuthDatasource.getMe(req.headers['authorization'])
    req.auth = {
      token: req.headers['authorization'],
      user: me,
    }
    next()
  } catch (err) {
    next(err)
  }
}

const userRouter = Router()

userRouter.use([validateAuthentication])
userRouter.all('/:username/', [userHandler])
userRouter.all('/:username/function/', [allFunctionsHandler])
userRouter.all('/:username/function/:functionName', [oneFunctionHandler])
userRouter.all('/:username/function/:functionName/run', [functionRunHandler])

export { userRouter }
