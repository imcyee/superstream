import { SerializationException } from "../errors";

export function check_reserved(value, reserved_characters) {
  for (const reserved of reserved_characters) {
    if (reserved in value) {
      throw new SerializationException(`encountered reserved character ${reserved} in ${value}`)
    }
  }
}