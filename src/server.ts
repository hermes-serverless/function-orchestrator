import express, { NextFunction, Request, Response } from 'express'
import morgan from 'morgan'
import { authRouter, userRouter } from './routes'
import { Logger } from './utils/Logger'

const server = express()

server.use(express.json())
server.use(morgan('dev'))

server.use('/auth', authRouter)
server.use('/user', userRouter)

server.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (!err.getStatusCode) err.getStatusCode = () => 500
  if (!err.getResponseObject) {
    err.getResponseObject = () => {
      return { error: 'InternalServerError', message: 'Something broke in the server' }
    }
  }
  Logger.error(`Error ${err.constructor.name}`, err)
  res.status(err.getStatusCode()).send(err.getResponseObject())
})

server.use('/', (_: Request, res: Response) => {
  res.status(404).send({
    error: 'PageNotFound',
    message: 'Page not found',
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  Logger.info(`Server listening on port http://localhost:${PORT}`)
})
