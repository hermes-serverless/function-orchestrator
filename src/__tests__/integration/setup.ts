import execa from 'execa'
import { hashElement } from 'folder-hash'
import fs from 'fs'
import path from 'path'

const buildWatcherScriptPath = path.join(__dirname, '../../../testUtils/buildWatcherImage.sh')
const md5Path = path.join(__dirname, '../../../tmp/hermes-functions-md5/')

const buildWatcher = (fnPath: string) => {
  const p = execa(buildWatcherScriptPath, [fnPath])
  p.all.pipe(process.stdout)
  return p
}

const getMd5 = (md5Path: string) => {
  if (fs.existsSync(md5Path)) return fs.readFileSync(md5Path, { encoding: 'utf-8' })
  return ''
}
const setup = async () => {
  if (!fs.existsSync(md5Path)) fs.mkdirSync(md5Path, { recursive: true })

  const paths = [path.join(__dirname, '../fixtures/hermes-functions/cpp/char-printer')]
  for (let i = 0; i < paths.length; i += 1) {
    const fnName = path.basename(paths[i])
    const fnMd5Path = path.join(md5Path, fnName)
    const md5 = getMd5(fnMd5Path)
    const { hash: res } = await hashElement(paths[i])
    if (res !== md5) {
      console.log(`---- DIFFENT MD5 ${fnName} - REBUILD WATCHER ----`)
      await buildWatcher(paths[i])
      fs.writeFileSync(fnMd5Path, res)
    }
  }

  console.log('--- DONE SETUP ---')
}

export default setup
