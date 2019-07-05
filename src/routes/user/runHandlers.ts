import { NextFunction, Response } from 'express'
import { RunDatasource } from '../../datasources'
import { AuthenticatedReq, RunProto } from '../../typings'
import { pickKeys } from './utils'

const requiredAttrs = ['startTime', 'status']
const optionalAttrs = ['endTime', 'outputPath']

export class RunHandler {
  public static handler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
    try {
      const ops = new RunHandler(req)
      if (req.method === 'GET') {
        const runs = await ops.get()
        res.status(200).send(runs)
      } else if (req.method === 'DELETE') {
        const deletedRuns = await ops.del()
        res.status(200).send(deletedRuns)
      } else if (req.method === 'PUT') {
        const updatedRun = await ops.upd()
        res.status(200).send(updatedRun)
      } else {
        res.status(400).send('This route only accepts GET, DELETE and PUT requests')
      }
    } catch (err) {
      next(err)
    }
  }

  protected req: AuthenticatedReq
  constructor(req: AuthenticatedReq) {
    this.req = req
  }

  public get = () => {
    const { runId } = this.req.params
    return RunDatasource.getRun(this.req.auth.user, { id: runId }, this.req.auth.token)
  }

  public del = () => {
    const { runId } = this.req.params
    return RunDatasource.deleteRun(this.req.auth.user, { id: runId }, this.req.auth.token)
  }

  public upd = () => {
    const req = this.req
    const { runId } = this.req.params
    const filteredBody = pickKeys([...requiredAttrs, ...optionalAttrs], req.body) as RunProto
    return RunDatasource.updateRun(req.auth.user, { id: runId }, filteredBody, req.auth.token)
  }
}

export class FunctionRunHandler {
  public static handler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
    try {
      const ops = new FunctionRunHandler(req)
      if (req.method === 'GET') {
        const runs = await ops.get()
        res.status(200).send(runs)
      } else if (req.method === 'DELETE') {
        const deletedRuns = await ops.del()
        res.status(200).send(deletedRuns)
      } else {
        res.status(400).send('This route only accepts GET and DELETE requests')
      }
    } catch (err) {
      next(err)
    }
  }

  protected req: AuthenticatedReq
  constructor(req: AuthenticatedReq) {
    this.req = req
  }

  public get = () => {
    const { functionOwner, functionName, functionVersion } = this.req.params
    return RunDatasource.getFunctionRun(
      this.req.auth.user,
      { functionOwner, functionName, functionVersion },
      this.req.auth.token
    )
  }

  public del = () => {
    const { functionOwner, functionName, functionVersion } = this.req.params
    return RunDatasource.deleteFunctionRun(
      this.req.auth.user,
      { functionOwner, functionName, functionVersion },
      this.req.auth.token
    )
  }
}
