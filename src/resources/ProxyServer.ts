import { Request, Response } from 'express'
import http from 'http'
import httpProxy from 'http-proxy'
import { Logger } from '../utils/Logger'

export type ReqChanger = (proxyReq: http.ClientRequest, req: http.IncomingMessage, res: http.ServerResponse) => void

export class Proxy {
  public static redirect = (
    req: Request,
    res: Response,
    url: string,
    changeReq?: ReqChanger,
    fnError?: (err: Error) => void
  ) => {
    const proxy = httpProxy.createProxyServer({
      target: url,
      ignorePath: true,
    })

    proxy.on('proxyReq', (proxyReq, req, res) => {
      if (changeReq) changeReq(proxyReq, req, res)
    })

    Logger.info(`Redirecting to ${url}`)
    proxy.web(req, res, {}, err => {
      Logger.error('Proxy error\n', err)
      fnError(err)
    })
  }
}
