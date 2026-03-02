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

function getThemeCss(theme: "dark" | "light" | "system") {
  if (theme === "dark") {
    return `
      :root{color-scheme:dark;}
      html,body{
        margin:0;
        padding:16px;
        background:#0b1220 !important;
        color:#e2e8f0 !important;
        font-family:Segoe UI,Arial,sans-serif;
      }
      .bk-root{
        background:var(--bk-surface-dark,#0f172a) !important;
        color:var(--bk-text-dark,#e2e8f0) !important;
        border:1px solid var(--bk-border-dark,#334155) !important;
        border-radius:16px;
      }
      .bk-root .bk-card{
        background:transparent !important;
        border:1px solid var(--bk-border-dark,#334155) !important;
        border-radius:16px;
      }
      .bk-root .bk-muted{color:var(--bk-muted-dark,#94a3b8) !important;}
      .bk-root .bk-link{color:var(--bk-link-dark,#67e8f9) !important;}
      .bk-root .bk-divider{border-top:1px solid var(--bk-border-dark,#334155) !important;}
      .bk-root .bk-button-wrap{background:transparent !important;}
      .bk-root .bk-button{
        background:var(--bk-accent-dark,#5f06f5) !important;
        border:1px solid var(--bk-accent-dark,#5f06f5) !important;
        color:var(--bk-button-text-dark,#ffffff) !important;
        text-decoration:none !important;
        border-radius:12px;
      }
      :where(table,tbody,tr,td,th,div,section,article,p,span,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,em,small):not([data-editor-style-lock="true"]):not([style*="color"]){
        color:inherit !important;
      }
      :where(table,tbody,tr,td,th,div,section,article,p,span,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,em,small):not([data-editor-style-lock="true"]):not([style*="border"]):not([style*="border-color"]){border-color:rgba(148,163,184,0.35) !important;}
      [style*="background"]:not(a):not(img):not([data-editor-style-lock="true"]),
      [style*="background-color"]:not(a):not(img):not([data-editor-style-lock="true"]){
        background:transparent !important;
        background-color:transparent !important;
      }
      a{color:#67e8f9;}
    `;
  }

  if (theme === "light") {
    return `
      :root{color-scheme:light;}
      html,body{
        margin:0;
        padding:16px;
        background:#ffffff !important;
        color:#0f172a !important;
        font-family:Segoe UI,Arial,sans-serif;
      }
      .bk-root{
        background:var(--bk-surface-light,#ffffff) !important;
        color:var(--bk-text-light,#0f172a) !important;
        border:1px solid var(--bk-border-light,#5f06f5) !important;
        border-radius:16px;
      }
      .bk-root .bk-card{
        background:transparent !important;
        border:1px solid var(--bk-border-light,#5f06f5) !important;
        border-radius:16px;
      }
      .bk-root .bk-muted{color:var(--bk-muted-light,#475569) !important;}
      .bk-root .bk-link{color:var(--bk-link-light,#5f06f5) !important;}
      .bk-root .bk-divider{border-top:1px solid var(--bk-border-light,#5f06f5) !important;}
      .bk-root .bk-button-wrap{background:transparent !important;}
      .bk-root .bk-button{
        background:var(--bk-accent-light,#5f06f5) !important;
        border:1px solid var(--bk-accent-light,#5f06f5) !important;
        color:var(--bk-button-text-light,#ffffff) !important;
        text-decoration:none !important;
        border-radius:12px;
      }
      :where(table,tbody,tr,td,th,div,section,article,p,span,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,em,small):not([data-editor-style-lock="true"]):not([style*="color"]){
        color:inherit !important;
      }
      :where(table,tbody,tr,td,th,div,section,article,p,span,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,em,small):not([data-editor-style-lock="true"]):not([style*="border"]):not([style*="border-color"]){border-color:rgba(100,116,139,0.35) !important;}
      [style*="background"]:not(a):not(img):not([data-editor-style-lock="true"]),
      [style*="background-color"]:not(a):not(img):not([data-editor-style-lock="true"]){
        background:transparent !important;
        background-color:transparent !important;
      }
      a{color:#0369a1;}
    `;
  }

  return `
    :root{color-scheme:light dark;}
    html,body{
      margin:0;
      padding:16px;
      font-family:Segoe UI,Arial,sans-serif;
      background:#ffffff;
      color:#0f172a;
    }
    @media (prefers-color-scheme: dark){
      html,body{
        background:#0b1220 !important;
        color:#e2e8f0 !important;
      }
      .bk-root{
        background:var(--bk-surface-dark,#0f172a) !important;
        color:var(--bk-text-dark,#e2e8f0) !important;
        border:1px solid var(--bk-border-dark,#334155) !important;
      }
      .bk-root .bk-card{
        background:transparent !important;
        border:1px solid var(--bk-border-dark,#334155) !important;
      }
      .bk-root .bk-muted{color:var(--bk-muted-dark,#94a3b8) !important;}
      .bk-root .bk-link{color:var(--bk-link-dark,#67e8f9) !important;}
      .bk-root .bk-divider{border-top:1px solid var(--bk-border-dark,#334155) !important;}
      .bk-root .bk-button{
        background:var(--bk-accent-dark,#5f06f5) !important;
        border:1px solid var(--bk-accent-dark,#5f06f5) !important;
        color:var(--bk-button-text-dark,#ffffff) !important;
      }
      :where(table,tbody,tr,td,th,div,section,article,p,span,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,em,small):not([data-editor-style-lock="true"]):not([style*="color"]){
        color:inherit !important;
      }
      :where(table,tbody,tr,td,th,div,section,article,p,span,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,em,small):not([data-editor-style-lock="true"]):not([style*="border"]):not([style*="border-color"]){border-color:rgba(148,163,184,0.35) !important;}
      [style*="background"]:not(a):not(img):not([data-editor-style-lock="true"]),
      [style*="background-color"]:not(a):not(img):not([data-editor-style-lock="true"]){
        background:transparent !important;
        background-color:transparent !important;
      }
      a{color:#67e8f9;}
    }
  `;
}

function getResizeScript(previewId: string) {
  const safeId = JSON.stringify(previewId);
  return `<script>(function(){const id=${safeId};const post=()=>{try{const body=document.body;const doc=document.documentElement;const height=Math.max(body?body.scrollHeight:0,body?body.offsetHeight:0,doc?doc.clientHeight:0,doc?doc.scrollHeight:0,doc?doc.offsetHeight:0);window.parent.postMessage({type:"ses-preview-height",id,height},"*");}catch(_e){}};if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",post);}else{post();}window.addEventListener("load",post);window.addEventListener("resize",post);const observer=new MutationObserver(post);observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true,characterData:true});setTimeout(post,60);setTimeout(post,250);setTimeout(post,800);})();</script>`;
}

function injectPreviewTheme(
  rawDocument: string,
  theme: "dark" | "light" | "system",
  previewId: string
) {
  const colorSchemeMeta =
    theme === "system"
      ? '<meta name="color-scheme" content="light dark" />'
      : `<meta name="color-scheme" content="${theme}" />`;
  const headAddon = `<meta charset="utf-8" />${colorSchemeMeta}<meta name="viewport" content="width=device-width,initial-scale=1" /><style>${getThemeCss(theme)}</style>${getResizeScript(previewId)}`;

  if (/<head[\s\S]*<\/head>/i.test(rawDocument)) {
    return rawDocument.replace(/<\/head>/i, `${headAddon}</head>`);
  }

  if (/<html[^>]*>/i.test(rawDocument)) {
    return rawDocument.replace(/<html[^>]*>/i, (match) => `${match}<head>${headAddon}</head>`);
  }

  return `<!doctype html><html><head>${headAddon}</head><body>${rawDocument}</body></html>`;
}

export function toPreviewDocument(
  input: string,
  theme: "dark" | "light" | "system" = "light",
  previewId = "preview"
) {
  const raw = sanitizePreviewHtml(stripScriptTags((input || "").trim()));
  const source = raw || "<p>No preview</p>";

  if (!raw) {
    return injectPreviewTheme(source, theme, previewId);
  }

  if (/<html[\s\S]*<\/html>/i.test(raw)) {
    return injectPreviewTheme(raw, theme, previewId);
  }

  return injectPreviewTheme(raw, theme, previewId);
}
