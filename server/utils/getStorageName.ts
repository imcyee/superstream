
export const getStorageName = () => {
  var storageName = 'redis'
  const storageOptions = ['redis', 'cassandra']
  if (process.env.STORAGE) {
    const envStorage = process.env.STORAGE
    if (!storageOptions.includes(envStorage))
      throw new Error(`Selected storage option is not available: ${envStorage}`)
    storageName = envStorage
  }
  return storageName
}