export function extractBodyHtml(input: string) {
  const raw = input?.trim() ?? "";
  if (!raw) {
    return "";
  }

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch?.[1]) {
    return raw;
  }

  return bodyMatch[1].trim();
}

export type HtmlDocumentShell = {
  prefix: string;
  body: string;
  suffix: string;
};

export function parseHtmlDocumentShell(input: string): HtmlDocumentShell | null {
  const raw = input ?? "";
  if (!raw.trim()) {
    return null;
  }

  const bodyOpenMatch = /<body\b[^>]*>/i.exec(raw);
  if (!bodyOpenMatch || bodyOpenMatch.index === undefined) {
    return null;
  }

  const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;
  const afterBodyOpen = raw.slice(bodyOpenEnd);
  const bodyCloseMatch = /<\/body\s*>/i.exec(afterBodyOpen);
  if (!bodyCloseMatch || bodyCloseMatch.index === undefined) {
    return null;
  }

  const bodyCloseStart = bodyOpenEnd + bodyCloseMatch.index;
  return {
    prefix: raw.slice(0, bodyOpenEnd),
    body: raw.slice(bodyOpenEnd, bodyCloseStart),
    suffix: raw.slice(bodyCloseStart)
  };
}

export function mergeBodyIntoHtmlDocument(
  bodyHtml: string,
  shell: HtmlDocumentShell | null | undefined
) {
  if (!shell) {
    return bodyHtml;
  }

  return `${shell.prefix}${bodyHtml}${shell.suffix}`;
}

export function sanitizeEditableHtml(input: string) {
  return (input || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<base[^>]*>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .trim();
}

function stripScriptTags(input: string) {
  return (input || "").replace(/<script[\s\S]*?<\/script>/gi, "");
}

function sanitizePreviewHtml(input: string) {
  return (input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .trim();
}

function forcePreviewColorSchemeMedia(input: string, theme: "dark" | "light" | "system") {
  if (theme === "system") {
    return input;
  }

  if (theme === "dark") {
    return input
      .replace(
        /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi,
        "@media all"
      )
      .replace(
        /@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)/gi,
        "@media not all"
      );
  }

  return input
    .replace(
      /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi,
      "@media not all"
    )
    .replace(
      /@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)/gi,
      "@media all"
    );
}

function applyPreviewColorSchemeMeta(input: string, theme: "dark" | "light" | "system") {
  if (theme === "system") {
    return input;
  }

  const preferred = theme === "dark" ? "dark light" : "light dark";
  const supported = "light dark";
  let result = input;

  if (/name=["']color-scheme["']/i.test(result)) {
    result = result.replace(
      /<meta\s+name=["']color-scheme["'][^>]*>/i,
      `<meta name="color-scheme" content="${preferred}">`
    );
  } else {
    result = result.replace(
      /<head[^>]*>/i,
      (headOpen) =>
        `${headOpen}<meta name="color-scheme" content="${preferred}">`
    );
  }

  if (/name=["']supported-color-schemes["']/i.test(result)) {
    result = result.replace(
      /<meta\s+name=["']supported-color-schemes["'][^>]*>/i,
      `<meta name="supported-color-schemes" content="${supported}">`
    );
  } else {
    result = result.replace(
      /<head[^>]*>/i,
      (headOpen) =>
        `${headOpen}<meta name="supported-color-schemes" content="${supported}">`
    );
  }

  return result;
}

const WRAPPER_START =
  "<table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='width:100%;max-width:680px;margin:0 auto;border-collapse:collapse;background:inherit'><tbody>";
const WRAPPER_END = "</tbody></table>";

export function toTableEmailHtml(input: string) {
  const cleaned = sanitizeEditableHtml(input || "");
  const body = extractBodyHtml(cleaned).trim();
  const source = body || cleaned;

  if (!source) {
    return (
      WRAPPER_START +
      "<tr><td style='padding:24px;font-family:inherit;color:inherit'><h1 style='margin:0 0 8px'>Hello {{name}}</h1><p style='margin:0'>Welcome to {{company}}.</p></td></tr>" +
      WRAPPER_END
    );
  }

  if (/<table[\s\S]*<\/table>/i.test(source)) {
    return source;
  }

  if (/<tr[\s\S]*<\/tr>/i.test(source)) {
    return `${WRAPPER_START}${source}${WRAPPER_END}`;
  }

  return `${WRAPPER_START}<tr><td style='padding:24px;font-family:inherit;color:inherit'>${source}</td></tr>${WRAPPER_END}`;
}

function getResizeScript(previewId: string) {
  const safeId = JSON.stringify(previewId);
  return `<script>(function(){const id=${safeId};const post=()=>{try{const body=document.body;const doc=document.documentElement;const height=Math.max(body?body.scrollHeight:0,body?body.offsetHeight:0,doc?doc.clientHeight:0,doc?doc.scrollHeight:0,doc?doc.offsetHeight:0);window.parent.postMessage({type:"ses-preview-height",id,height},"*");}catch(_e){}};if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",post);}else{post();}window.addEventListener("load",post);window.addEventListener("resize",post);const observer=new MutationObserver(post);observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true,characterData:true});setTimeout(post,60);setTimeout(post,250);setTimeout(post,800);})();</script>`;
}

function injectPreviewRuntime(
  rawDocument: string,
  previewId: string
) {
  const headAddon =
    '<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />' +
    getResizeScript(previewId);
  const bodyAddon = getResizeScript(previewId);

  if (/<head[\s\S]*<\/head>/i.test(rawDocument)) {
    return rawDocument.replace(/<\/head>/i, `${headAddon}</head>`);
  }

  if (/<html[^>]*>/i.test(rawDocument)) {
    if (/<\/body>/i.test(rawDocument)) {
      return rawDocument
        .replace(/<html[^>]*>/i, (match) => `${match}<head>${headAddon}</head>`)
        .replace(/<\/body>/i, `${bodyAddon}</body>`);
    }
    return rawDocument.replace(/<html[^>]*>/i, (match) => `${match}<head>${headAddon}</head>`);
  }

  return `<!doctype html><html><head>${headAddon}</head><body>${rawDocument}${bodyAddon}</body></html>`;
}

export function toPreviewDocument(
  input: string,
  theme: "dark" | "light" | "system" = "light",
  previewId = "preview"
) {
  const raw = sanitizePreviewHtml(stripScriptTags((input || "").trim()));
  const source = forcePreviewColorSchemeMedia(raw || "<p>No preview</p>", theme);

  if (!raw || !source.trim()) {
    return injectPreviewRuntime(source, previewId);
  }

  if (/<html[\s\S]*<\/html>/i.test(source)) {
    return injectPreviewRuntime(applyPreviewColorSchemeMeta(source, theme), previewId);
  }

  return injectPreviewRuntime(source, previewId);
}
