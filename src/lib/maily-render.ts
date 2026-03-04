import { render } from "@maily-to/render";
import {
  getBrandKitBaseColors,
  getBrandKitColorSchemeCss,
  type BrandKit
} from "@/lib/brand-kits";

const BRAND_KIT_STYLE_ID = "ses-brand-kit-color-bridge";

function upsertStyleTag(html: string, styleId: string, css: string) {
  const existingPattern = new RegExp(
    `<style[^>]*id=["']${styleId}["'][^>]*>[\\s\\S]*?<\\/style>`,
    "i"
  );

  if (!css.trim()) {
    return html.replace(existingPattern, "");
  }

  const styleTag = `<style id="${styleId}">${css}</style>`;
  if (existingPattern.test(html)) {
    return html.replace(existingPattern, styleTag);
  }

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleTag}</head>`);
  }

  return `${styleTag}${html}`;
}

function normalizeLinkCardBadgeToVariable(html: string) {
  return html
    .replace(
      /background-color\s*:\s*(?:#fef08a|rgb\(\s*254\s*,\s*240\s*,\s*138\s*\))/gi,
      "background-color:var(--mly-color-yellow-200,#fef08a)"
    )
    .replace(
      /background\s*:\s*(?:#fef08a|rgb\(\s*254\s*,\s*240\s*,\s*138\s*\))/gi,
      "background:var(--mly-color-yellow-200,#fef08a)"
    );
}

function normalizeMailyDefaultsToBrandKitVariables(html: string) {
  return html
    .replace(
      /background-color\s*:\s*#ffffff/gi,
      "background-color:var(--ses-surface-color,#ffffff)"
    )
    .replace(
      /background-color\s*:\s*#f7f7f7/gi,
      "background-color:var(--ses-surface-color,#f7f7f7)"
    )
    .replace(
      /color\s*:\s*#374151/gi,
      "color:var(--ses-text-color,#374151)"
    )
    .replace(
      /color\s*:\s*#6b7280/gi,
      "color:var(--ses-muted-color,#6B7280)"
    )
    .replace(
      /color\s*:\s*#111827/gi,
      "color:var(--ses-text-color,#111827)"
    )
    .replace(
      /border-top\s*:\s*1px\s+solid\s+#eaeaea/gi,
      "border-top:1px solid var(--ses-border-color,#eaeaea)"
    )
    .replace(
      /border\s*:\s*1px\s+solid\s+#eaeaea/gi,
      "border:1px solid var(--ses-border-color,#eaeaea)"
    )
    .replace(
      /border-color\s*:\s*#eaeaea/gi,
      "border-color:var(--ses-border-color,#eaeaea)"
    );
}

function resetLinkCardBadgeVariable(html: string) {
  return html
    .replace(
      /var\(\s*--mly-color-yellow-200\s*,\s*[^)]+\)/gi,
      "#fef08a"
    )
    .replace(/--mly-color-yellow-200\s*:[^;]+;/gi, "--mly-color-yellow-200:#fef08a;");
}

export function applyBrandKitToRenderedHtml(
  html: string,
  brandKit: BrandKit | null | undefined
) {
  if (!brandKit) {
    return resetLinkCardBadgeVariable(upsertStyleTag(html, BRAND_KIT_STYLE_ID, ""));
  }

  const css = getBrandKitColorSchemeCss(brandKit);
  html = upsertStyleTag(html, BRAND_KIT_STYLE_ID, css);

  const accent = getBrandKitBaseColors(brandKit.colors).accent.trim();
  if (accent && /--mly-color-yellow-200\s*:/i.test(html)) {
    const replacement = `--mly-color-yellow-200:${accent};`;
    html = html.replace(/--mly-color-yellow-200\s*:[^;]+;/gi, replacement);
  }

  return normalizeMailyDefaultsToBrandKitVariables(
    normalizeLinkCardBadgeToVariable(html)
  );
}

export async function renderEditorJsonToHtml(
  json: Record<string, unknown>,
  brandKit: BrandKit | null | undefined
) {
  const rendered = await render(json);
  return applyBrandKitToRenderedHtml(rendered, brandKit);
}
