import { NextFunction, Response, Router } from 'express'
import { AuthDatasource } from '../../datasources/AuthDatasource'
import { AuthenticationError, RouteError } from '../../datasources/Errors'
import { AuthenticatedReq } from '../../typings'
import { AllFunctionsHandler, BaseFunctionHandler, OneFunctionHandler } from './functionHandlers'
import { FunctionRunHandler, RunHandler } from './runHandlers'
import { userHandler } from './userHandlers'
import { newRunHandler, runResultHandler, runStatusHandler } from './watcherHandler'

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

const checkAuthorization = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params
    const usernameRequesting = req.auth.user.username
    if (username !== usernameRequesting) {
      throw new RouteError({
        errorName: 'Unauthorized',
        message: `You, ${usernameRequesting}, is requesting restricted info from another possible user, ${username}`,
        statusCode: 401,
      })
    }
    next()
  } catch (err) {
    next(err)
  }
}

const userRouter = Router()

userRouter.use([validateAuthentication])
userRouter.use('/:username', [checkAuthorization])
userRouter.all('/:username/', [userHandler])

userRouter.all('/:username/function/', [AllFunctionsHandler.handler])
userRouter.all('/:username/function/:functionName', [BaseFunctionHandler.handler])
userRouter.all('/:username/function/:functionName/:functionVersion', [OneFunctionHandler.handler])

userRouter.all('/:username/runs/', [RunHandler.handler])
userRouter.all('/:username/runs/:runId', [RunHandler.handler])
userRouter.all('/:username/function-runs/:functionOwner', [FunctionRunHandler.handler])
userRouter.all('/:username/function-runs/:functionOwner/:functionName', [
  FunctionRunHandler.handler,
])
userRouter.all('/:username/function-runs/:functionOwner/:functionName/:functionVersion', [
  FunctionRunHandler.handler,
])

userRouter.all('/:username/run/:functionOwner/:functionName/:functionVersion', [newRunHandler])
userRouter.all('/:username/run/:runId/status', [runStatusHandler])
userRouter.all('/:username/run/:runId/result', [runResultHandler])

export { userRouter }
