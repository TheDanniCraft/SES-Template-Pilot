export function decodeEscapedUnicode(input: string) {
  if (!input || !/\\u[0-9a-fA-F]{4}/.test(input)) {
    return input;
  }

  return input.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

