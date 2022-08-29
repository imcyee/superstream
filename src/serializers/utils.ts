import { SerializationException } from "../errors";

export function checkReserved(value, reservedCharacters) {
  for (const reserved of reservedCharacters) {
    if (value.includes(reserved)) {
      throw new SerializationException(`encountered reserved character ${reserved} in ${value}`)
    }
  }
}