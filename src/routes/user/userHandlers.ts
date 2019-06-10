import { Logger } from '../../utils/Logger'
import { Response, NextFunction } from 'express'
import { InvalidRequestArguments } from '../../datasources/Errors'
import { AuthenticatedReq } from '../../typings'
import { UserDatasource } from '../../datasources'

export const userHandler = async (req: AuthenticatedReq, res: Response, next: NextFunction) => {
  try {
    if (req.method == 'DELETE') {
      const deletedUser = await UserDatasource.deleteUser(req.auth.user, req.auth.token)
      res.status(200).send(deletedUser)
    } else if (req.method == 'PUT') {
      if (!req.body.username) throw new InvalidRequestArguments('Missing username field on request')
      const updatedUser = await UserDatasource.updateUser(req.auth.user, req.body, req.auth.token)
      res.status(200).send(updatedUser)
    } else {
      res.status(400).send('This route only accepts DELETE and PUT requests')
    }
  } catch (err) {
    next(err)
  }
}
