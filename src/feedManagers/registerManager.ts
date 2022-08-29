export const registeredManagers = {}

/**
 * Register manager for task
 * @param target 
 * @param propertyKey 
 * @param descriptor 
 * @returns 
 */
export function RegisterManager() {
  return (target) => {
    const key = target.name
    if (registeredManagers[key])
      throw new Error(`Duplicated manager found: ${registeredManagers[key]}`)
    registeredManagers[key] = target
    return target;
  }
}

 