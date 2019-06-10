import { Logger } from '../../utils/Logger'
import { Response, NextFunction } from 'express'
import { InvalidRequestArguments } from '../../datasources/Errors'
import { AuthenticatedReq } from '../../typings'
import { FunctionDatasource } from '../../datasources'

const checkValidBody = (body: any) => {
  const attrs = ['functionName', 'language', 'gpuCapable', 'scope', 'imageUrl', 'functionVersion']
  attrs.forEach(el => {
    if (body[el] == null) throw new InvalidRequestArguments(`Missing ${el} field on request`)
  })
}

export const allFunctionsHandler = async (
  req: AuthenticatedReq,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.method == 'GET') {
      const allFunctions = await FunctionDatasource.getFunctions(req.auth.user, req.auth.token)
      res.status(200).send(allFunctions)
    } else if (req.method == 'POST') {
      checkValidBody(req.body)
      const newFunction = await FunctionDatasource.createFunction(
        req.auth.user,
        req.body,
        req.auth.token
      )
      res.status(200).send(newFunction)
    } else {
      res.status(400).send('This route only accepts GET and POST requests')
    }
  } catch (err) {
    next(err)
  }
}

export const oneFunctionHandler = async (
  req: AuthenticatedReq,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.method == 'GET') {
      const fn = await FunctionDatasource.getFunction(
        req.auth.user,
        req.params.functionName,
        req.auth.token
      )
      res.status(200).send(fn)
    } else if (req.method == 'DELETE') {
      const deletedFn = await FunctionDatasource.deleteFunction(
        req.auth.user,
        req.params.functionName,
        req.auth.token
      )
      res.status(200).send(deletedFn)
    } else {
      res.status(400).send('This route only accepts GET and DELETE requests')
    }
  } catch (err) {
    next(err)
  }
}

export const functionRunHandler = async (
  req: AuthenticatedReq,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.method == 'POST') {
      const fn = await FunctionDatasource.getFunction(
        req.auth.user,
        req.params.functionName,
        req.auth.token
      )
      res.status(200).send(fn)
    } else {
      res.status(400).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}
