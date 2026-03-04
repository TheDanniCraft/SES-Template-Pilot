import { toTableEmailHtml } from "@/lib/html-utils";

export const BRAND_KIT_COLOR_KEYS = [
  "text",
  "muted",
  "surface",
  "border",
  "accent",
  "link",
  "buttonText"
] as const;

export type BrandKitColorKey = (typeof BRAND_KIT_COLOR_KEYS)[number];

export type BrandKitColorValues = {
  text: string;
  muted: string;
  surface: string;
  border: string;
  accent: string;
  link: string;
  buttonText: string;
};

export type BrandKitColors = BrandKitColorValues & {
  dark?: BrandKitColorValues;
  light?: BrandKitColorValues;
};

export type BrandKit = {
  id: string;
  name: string;
  iconUrl: string;
  colors: BrandKitColors;
};

export function getBrandKitBaseColors(colors: BrandKitColors): BrandKitColorValues {
  return {
    text: colors.text,
    muted: colors.muted,
    surface: colors.surface,
    border: colors.border,
    accent: colors.accent,
    link: colors.link,
    buttonText: colors.buttonText
  };
}

function getBrandKitLightColors(colors: BrandKitColors): BrandKitColorValues {
  const base = getBrandKitBaseColors(colors);
  return colors.light ?? base;
}

export function hasBrandKitModeVariants(brandKit: BrandKit | null | undefined) {
  return Boolean(brandKit?.colors.dark);
}

export function getBrandKitThemeColors(
  brandKit: BrandKit,
  mode: "dark" | "light"
): BrandKitColorValues {
  const base = getBrandKitLightColors(brandKit.colors);
  if (mode === "dark") {
    return brandKit.colors.dark ?? base;
  }
  return base;
}

function toColorSchemeCssVars(colors: BrandKitColorValues) {
  return [
    `--mly-color-yellow-200:${colors.accent}`,
    `--ses-surface-color:${colors.surface}`,
    `--ses-text-color:${colors.text}`,
    `--ses-muted-color:${colors.muted}`,
    `--ses-link-color:${colors.link}`,
    `--ses-border-color:${colors.border}`,
    `--ses-button-text-color:${colors.buttonText}`
  ].join(";");
}

export function getBrandKitColorSchemeCss(brandKit: BrandKit | null | undefined) {
  if (!brandKit) {
    return "";
  }

  const light = getBrandKitThemeColors(brandKit, "light");
  if (!brandKit.colors.dark) {
    return `:root{${toColorSchemeCssVars(light)}}`;
  }

  const dark = getBrandKitThemeColors(brandKit, "dark");
  return [
    `:root{${toColorSchemeCssVars(light)}}`,
    `@media (prefers-color-scheme: dark){:root{${toColorSchemeCssVars(dark)}}}`
  ].join("");
}

export function getBrandKitById(
  kits: BrandKit[],
  id: string | null | undefined
) {
  if (!id) {
    return null;
  }
  return kits.find((kit) => kit.id === id) ?? null;
}

export function applyBrandKitToHtml(inputHtml: string, brandKit: BrandKit) {
  const normalized = toTableEmailHtml(inputHtml);
  if (typeof document === "undefined") {
    return normalized;
  }

  const container = document.createElement("div");
  container.innerHTML = normalized;

  const rootTable = container.querySelector("table");
  if (rootTable) {
    const darkColors = getBrandKitThemeColors(brandKit, "dark");
    const lightColors = getBrandKitThemeColors(brandKit, "light");

    rootTable.classList.add("bk-root");
    rootTable.style.setProperty("--bk-text-dark", darkColors.text);
    rootTable.style.setProperty("--bk-muted-dark", darkColors.muted);
    rootTable.style.setProperty("--bk-surface-dark", darkColors.surface);
    rootTable.style.setProperty("--bk-border-dark", darkColors.border);
    rootTable.style.setProperty("--bk-accent-dark", darkColors.accent);
    rootTable.style.setProperty("--bk-link-dark", darkColors.link);
    rootTable.style.setProperty("--bk-button-text-dark", darkColors.buttonText);

    rootTable.style.setProperty("--bk-text-light", lightColors.text);
    rootTable.style.setProperty("--bk-muted-light", lightColors.muted);
    rootTable.style.setProperty("--bk-surface-light", lightColors.surface);
    rootTable.style.setProperty("--bk-border-light", lightColors.border);
    rootTable.style.setProperty("--bk-accent-light", lightColors.accent);
    rootTable.style.setProperty("--bk-link-light", lightColors.link);
    rootTable.style.setProperty("--bk-button-text-light", lightColors.buttonText);
  }

  container.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.removeAttribute("data-editor-style-lock");
    el.classList.remove("bk-muted", "bk-link", "bk-button", "bk-button-wrap", "bk-card");
    el.style.removeProperty("color");
    el.style.removeProperty("background");
    el.style.removeProperty("background-color");
    el.style.removeProperty("border-color");
  });

  container.querySelectorAll(".muted").forEach((node) => {
    const el = node as HTMLElement;
    el.classList.add("bk-muted");
  });

  container.querySelectorAll(".card").forEach((node) => {
    const el = node as HTMLElement;
    el.classList.add("bk-card");
  });

  container.querySelectorAll("hr").forEach((node) => {
    const el = node as HTMLElement;
    el.classList.add("bk-divider");
  });

  container.querySelectorAll("a").forEach((node) => {
    const el = node as HTMLAnchorElement;
    const looksLikeButton =
      el.style.display === "inline-block" ||
      el.style.borderRadius.length > 0 ||
      el.style.padding.length > 0;

    if (looksLikeButton) {
      el.classList.add("bk-button");
      const parentCell = el.parentElement;
      if (parentCell?.tagName === "TD") {
        parentCell.classList.add("bk-button-wrap");
      }
    } else {
      el.classList.add("bk-link");
    }
  });

  const firstImage = container.querySelector("img") as HTMLImageElement | null;
  if (firstImage) {
    firstImage.src = brandKit.iconUrl;
    firstImage.alt = `${brandKit.name} icon`;
  }

  return container.innerHTML;
}
