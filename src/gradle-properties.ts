/**
 * Read a single property value from the text of a `gradle.properties` file.
 * Returns `undefined` when the key is absent. Keys and values are trimmed, and
 * lines without an `=` are ignored.
 */
export function getGradleProperty(propertyName: string, text: string): string | undefined {
  const [, value] =
    text
      .split("\n")
      .map((row) => {
        const eq = row.indexOf("=");
        // Split on the first `=` only, so values may themselves contain `=` (e.g. URLs).
        return eq === -1 ? ["", ""] : [row.slice(0, eq).trim(), row.slice(eq + 1).trim()];
      })
      .find(([key]) => key === propertyName) ?? [];

  return value;
}
