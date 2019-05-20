import { Logger } from './utils/Logger'
import express from 'express'
import morgan from 'morgan'
import httpProxy from 'http-proxy'
import { WatchersManager } from './resources/WatchersManager/WatchersManager'
import axios from 'axios'

const adresses = {
  FunctionBuilder: 'http://function-builder:3001/',
}

const server = express()
const proxy = httpProxy.createProxyServer()

server.use(express.json())
server.use(morgan('dev'))

server.use('/deploy', async (req, res) => {
  proxy.web(req, res, { target: adresses.FunctionBuilder + 'build/?function-watcher=true' })
})

server.use('/build', async (req, res) => {
  // proxy.web(req, res, { target: adresses.FunctionBuilder + 'build/?project=true' })
  console.log('POXY')
  proxy.web(req, res, { target: 'http://e2882818ee9250311615469ebcdb29ac:3000/' })
})

server.use('/run', async (req, res) => {
  const { username, functionName, lang, gpuCapable } = req.query
  await WatchersManager.run(
    {
      username,
      functionName,
      lang,
      gpuCapable,
    },
    async (endpoint: string) => {
      Logger.info(`Proxy to ${endpoint}`)
      const data = await axios.post(endpoint)
      console.log(data)
      proxy.web(req, res, { target: endpoint })
    }
  )
})

server.use('/', (_, res) => {
  res.status(404).send('Not found')
})

const PORT = 3000
server.listen(PORT, () => {
  Logger.info(`Server listening on port http://localhost:${PORT}`)
})
