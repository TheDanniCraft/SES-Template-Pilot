export function htmlToPlainText(html: string) {
  const raw = (html || "").trim();
  if (!raw) {
    return "";
  }

  const withLinks = raw.replace(
    /<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, _quote, href: string, inner: string) => {
      const linkText = stripTags(inner).trim().replace(/\s+/g, " ");
      const cleanHref = (href || "").trim();
      if (linkText && cleanHref) {
        return `${linkText}: ${cleanHref}`;
      }
      if (cleanHref) {
        return cleanHref;
      }
      return linkText || "Link";
    }
  );

  const withLineBreaks = withLinks
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h1|h2|h3|h4|h5|h6|li|tr|table|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ");

  const withoutTags = withLineBreaks
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(withoutTags);

  return decoded
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(value: string) {
  return (value || "").replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string) {
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
