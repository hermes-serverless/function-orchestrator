import { NextFunction, Response } from 'express'
import { AuthenticatedReq } from '../../typings'
import { RunsManager } from './../../resources/RunsManager/index'

export const newRunHandler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const { functionOwner, functionName, functionVersion } = req.params
      const runType = req.headers['x-hermes-run-type'] as 'async' | 'sync'

      const run = await RunsManager.createRun(
        {
          functionOwner,
          functionName,
          functionVersion,
          user: req.auth.user,
        },
        req.auth.token
      )

      await run.startRun(req, res, req.auth.token, runType)
    } else {
      res.status(400).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

export const runStatusHandler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
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

export const runResultOutputHandler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      const run = await RunsManager.getRun(req.auth.user, req.params.runId, req.auth.token)
      const output = await run.resultOutput()
      res.status(200)
      output.pipe(res)
    } else {
      res.status(400).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}

export const runResultInfoHandler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      const run = await RunsManager.getRun(req.auth.user, req.params.runId, req.auth.token)
      const info = await run.resultInfo()
      res.status(200).send(info)
    } else {
      res.status(400).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}
