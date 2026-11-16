// Anything outside the XML 1.0 Char production (C0 controls other than tab,
// newline and carriage return; lone surrogates; U+FFFE/U+FFFF) makes the
// document ill-formed, and strict parsers such as resvg reject it outright.
const INVALID_XML_CHARS = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

export function escapeXml(s: string): string {
  return s
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
