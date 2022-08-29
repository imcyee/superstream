
// index.js
// run with node --experimental-worker index.js on Node.js 10.x
import { Worker } from 'worker_threads'
import path from 'path'

const serviceFilePath = path.join(__dirname, 'service.js')

function runService(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(serviceFilePath, { workerData });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    })
  })
}

async function run() {
  const result = await runService('world')
  console.log(result);
}

describe('worker thread', () => {
  it('Run thread', async () => {
    await run().catch(err => console.error(err))
  })
})