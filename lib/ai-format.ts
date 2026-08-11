export function cleanAdviserText(value: string) {
  return value
    .replace(/^[\t ]{0,3}#{1,6}[\t ]*/gm, "")
    .replace(/^[\t ]*[-*_]{3,}[\t ]*$/gm, "")
    .replace(/^[\t ]*[-*+][\t ]+/gm, "• ")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/___([^_]+)___/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
