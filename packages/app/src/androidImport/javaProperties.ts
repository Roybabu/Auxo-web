/**
 * Minimal parser for Java's `.properties` text format, used by the Android
 * app's manifest.properties entry (BackupArchive.kt writes it with
 * `java.util.Properties.store()`). Handles what that writer actually
 * produces: `key=value` lines, `#`/`!` comments, and backslash escapes for
 * `\n`, `\t`, `\\`, `\:`, `\=`, and `\uXXXX`. Not a complete implementation
 * of the Java properties spec (no line-continuation support), since that's
 * not something `Properties.store()` itself emits.
 */
export function parseJavaProperties(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r\n|\r|\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimStart();
    if (line.length === 0 || line.startsWith("#") || line.startsWith("!")) continue;

    const separatorIndex = findUnescapedSeparator(line);
    if (separatorIndex === -1) continue;

    const rawKey = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    result[unescapeJavaProperty(rawKey.trim())] = unescapeJavaProperty(rawValue.trim());
  }

  return result;
}

function findUnescapedSeparator(line: string): number {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\") {
      i++; // skip the escaped character
      continue;
    }
    if (c === "=" || c === ":") return i;
    // An unescaped space also separates key/value in the Java format, but
    // Properties.store() always writes '=', so that's the common case here.
  }
  return -1;
}

function unescapeJavaProperty(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c !== "\\" || i === value.length - 1) {
      out += c;
      continue;
    }
    const next = value[i + 1];
    switch (next) {
      case "n":
        out += "\n";
        i++;
        break;
      case "t":
        out += "\t";
        i++;
        break;
      case "r":
        out += "\r";
        i++;
        break;
      case "\\":
        out += "\\";
        i++;
        break;
      case ":":
        out += ":";
        i++;
        break;
      case "=":
        out += "=";
        i++;
        break;
      case "u": {
        const hex = value.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 5;
        } else {
          out += c;
        }
        break;
      }
      default:
        out += next;
        i++;
    }
  }
  return out;
}
