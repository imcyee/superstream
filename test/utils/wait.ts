
export async function wait(timeInMillis: number) {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res(null)
    }, timeInMillis)
  })
}
