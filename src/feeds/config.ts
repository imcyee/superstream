var seperator = ''

/**
 * set seperator for follow and unfollow function
 * @param opts 
 */
export const setFeedConfig = (opts: {
  seperator?,
}) => {
  seperator = opts.seperator
}

export const getSeparator = () => {
  return seperator
}