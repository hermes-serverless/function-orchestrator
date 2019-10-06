import { NextFunction, Response } from 'express'
import { FunctionDatasource } from '../../datasources'
import { AuthenticatedReq } from '../../typings'
import { HermesFunctionProto } from './../../typings.d'
import { checkifBodyIsValid, pickKeys } from './utils'

const requiredAttrs = ['functionName', 'language', 'gpuCapable', 'scope', 'imageName', 'functionVersion']

export class BaseFunctionHandler {
  public static handler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
    try {
      const ops = new OneFunctionHandler(req)
      if (req.method === 'GET') {
        const fn = await ops.get()
        res.status(200).send(fn)
      } else if (req.method === 'DELETE') {
        const deletedFn = await ops.del()
        res.status(200).send(deletedFn)
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
    const { functionName, functionVersion } = this.req.params
    return FunctionDatasource.getFunction(this.req.auth.user, { functionName, functionVersion }, this.req.auth.token)
  }

  public del = () => {
    const { functionName, functionVersion } = this.req.params
    return FunctionDatasource.deleteFunction(this.req.auth.user, { functionName, functionVersion }, this.req.auth.token)
  }
}

export class AllFunctionsHandler extends BaseFunctionHandler {
  public static handler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
    try {
      const ops = new AllFunctionsHandler(req)
      if (req.method === 'GET') {
        const allFunctions = await ops.get()
        res.status(200).send(allFunctions)
      } else if (req.method === 'POST') {
        const newFunction = await ops.create()
        res.status(200).send(newFunction)
      } else {
        res.status(400).send('This route only accepts GET and POST requests')
      }
    } catch (err) {
      next(err)
    }
  }

  public create = () => {
    const req = this.req
    const filteredBody = pickKeys(requiredAttrs, req.body) as HermesFunctionProto
    checkifBodyIsValid(requiredAttrs, filteredBody)
    return FunctionDatasource.createFunction(req.auth.user, filteredBody, req.auth.token)
  }
}

export class OneFunctionHandler extends BaseFunctionHandler {
  public static handler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
    try {
      const ops = new OneFunctionHandler(req)
      if (req.method === 'GET') {
        const fn = await ops.get()
        res.status(200).send(fn)
      } else if (req.method === 'DELETE') {
        const deletedFn = await ops.del()
        res.status(200).send(deletedFn)
      } else if (req.method === 'PUT') {
        const updatedFn = await ops.upd()
        res.status(200).send(updatedFn)
      } else {
        res.status(400).send('This route only accepts GET, DELETE and PUT requests')
      }
    } catch (err) {
      next(err)
    }
  }

  public upd = async () => {
    const req = this.req
    const { functionName, functionVersion } = req.params
    const filteredBody = pickKeys(requiredAttrs, req.body) as HermesFunctionProto
    return FunctionDatasource.updateFunction(
      req.auth.user,
      {
        functionName,
        functionVersion,
      },
      filteredBody,
      req.auth.token
    )
  }
}
