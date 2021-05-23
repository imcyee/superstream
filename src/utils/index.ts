import lodashZip from 'lodash/zip'

export const zip = lodashZip

export const datetime_to_epoch = (datetime) => {
  return (new Date(datetime).getTime() / 1000) // '%.6f' % datetime_to_epoch(activity.time)
}

export const epoch_to_datetime = (epoch) => {
  return new Date(epoch * 1000)
}


export function make_list_unique(
  sequence,
  marker_function = null) {
  // '''
  // Makes items in a list unique
  // Performance based on this blog post:
  // http://www.peterbe.com/plog/uniqifiers-benchmark
  // '''
  const seen = {}
  const result = []
  for (const item of sequence) {
    // # gets the marker
    var marker = item
    if (marker_function) {
      marker = marker_function(item)
    }
    // # if no longer unique make unique
    if (marker in seen) {
      continue
    }
    seen[marker] = true
    result.push(item)
  }
  return result
}

export function dictZip(zip) {
  const json = {}
  for (const z of zip) {
    if (z.length !== 2)
      throw new Error('zip pair must be exactly two element in an array')
    json[z[0]] = z[1]
  }
  return json
}


export function parseBigInt(
  numberString,
  base
  // keyspace = "0123456789abcdefghijklmnopqrstuvwxyz",
) {
  var keyspace
  if (base === 10) {
    keyspace = "0123456789"
  } else if (base === 16) {
    keyspace = "0123456789abcdef"
  }

  let result = BigInt(0);
  const keyspaceLength = BigInt(keyspace.length);
  for (let i = numberString.length - 1; i >= 0; i--) {
    const value = keyspace.indexOf(numberString[i]);
    if (value === -1) throw new Error("invalid string");
    result = result * keyspaceLength + BigInt(value);
  }
  return result;
}
