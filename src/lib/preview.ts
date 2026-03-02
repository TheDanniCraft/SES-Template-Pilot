export function renderTemplateVariables(
  source: string,
  values: Record<string, string>
) {
  return Object.entries(values).reduce((result, [key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, "g"), value);
  }, source);
}
