import { render } from "@maily-to/render";
import type { BrandKit } from "@/lib/brand-kits";

export function applyBrandKitToRenderedHtml(
  html: string,
  brandKit: BrandKit | null | undefined
) {
  if (!brandKit) {
    return html;
  }

  const accent = brandKit.colors.accent.trim();
  if (!accent) {
    return html;
  }

  const replacement = `--mly-color-yellow-200:${accent};`;
  if (/--mly-color-yellow-200\s*:/i.test(html)) {
    html = html.replace(/--mly-color-yellow-200\s*:[^;]+;/gi, replacement);
  }

  if (/<\/head>/i.test(html)) {
    html = html.replace(
      /<\/head>/i,
      `<style>:root{--mly-color-yellow-200:${accent};}</style></head>`
    );
  }

  // Maily link-card output may contain fixed inline badge yellow.
  return html.replace(/background-color:\s*#fef08a/gi, `background-color:${accent}`);
}

export async function renderEditorJsonToHtml(
  json: Record<string, unknown>,
  brandKit: BrandKit | null | undefined
) {
  const rendered = await render(json);
  return applyBrandKitToRenderedHtml(rendered, brandKit);
}

