import { RunsManager } from './../../resources/RunsManager/index'
import { NextFunction, Response } from 'express'
import { AuthenticatedReq } from '../../typings'

export const newRunHandler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const { functionOwner, functionName, functionVersion } = req.params

      const run = RunsManager.createRun(
        {
          functionOwner,
          functionName,
          functionVersion,
          user: req.auth.user,
        },
        req.auth.token
      )

      await run.startRun(req, res, req.auth.token, req.auth.user)
    } else {
      res.status(400).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

export const runStatusHandler = async (
  req: AuthenticatedReq,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.method === 'GET') {
      const run = await RunsManager.getRun(req.auth.user, req.params.runId, req.auth.token)
      const status = await run.getStatus()
      res.status(200)
      status.pipe(res)
    } else {
      res.status(400).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}

export const runResultHandler = async (
  req: AuthenticatedReq,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.method === 'GET') {
      const run = await RunsManager.getRun(req.auth.user, req.params.runId, req.auth.token)
      const resultStream = await run.getResult()
      res.status(200)
      resultStream.pipe(res)
    } else {
      res.status(400).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}
