const { workerData, parentPort } = require('worker_threads')


const handleWorker = (workerData) => {
  switch (workerData) {
    case 'fnname':
      console.log('fnname');
      break
    default:
      console.log('default');
      break
  }
}
handleWorker(workerData)

// You can do any heavy stuff here, in a synchronous way
// without blocking the "main thread"
console.log('1');
parentPort.postMessage({ hello: workerData })
console.log('2');
parentPort.postMessage({ hello: workerData })
console.log('3');
parentPort.postMessage({ hello: workerData })