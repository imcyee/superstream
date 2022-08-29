export const splitId = (id, seperator) => {
  if (!seperator)
    return id
  const splitted = id.split(seperator)
  const splittedId = splitted?.length
    ? splitted.at(-1)
    : id
  return splittedId
}