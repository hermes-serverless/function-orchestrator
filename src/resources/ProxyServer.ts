import { Request, Response } from 'express'
import httpProxy from 'http-proxy'
import { Logger } from '../utils/Logger'

export class Proxy {
  private static proxy = httpProxy.createProxyServer({})

  public static redirect = (
    req: Request,
    res: Response,
    url: string,
    fnError?: (err: Error) => void
  ) => {
    Logger.info(`Redirecting to ${url}`)
    Proxy.proxy.web(req, res, { target: url, ignorePath: true }, err => {
      Logger.error('Proxy error', err)
      fnError(err)
    })
  }
}
