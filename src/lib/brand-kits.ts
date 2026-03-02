import { toTableEmailHtml } from "@/lib/html-utils";

type BrandKitColors = {
  text: string;
  muted: string;
  surface: string;
  border: string;
  accent: string;
  link: string;
  buttonText: string;
};

export type BrandKit = {
  id: string;
  name: string;
  iconUrl: string;
  colors: BrandKitColors;
};

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
    rootTable.classList.add("bk-root");
    rootTable.style.setProperty("--bk-text-dark", brandKit.colors.text);
    rootTable.style.setProperty("--bk-muted-dark", brandKit.colors.muted);
    rootTable.style.setProperty("--bk-surface-dark", brandKit.colors.surface);
    rootTable.style.setProperty("--bk-border-dark", brandKit.colors.border);
    rootTable.style.setProperty("--bk-accent-dark", brandKit.colors.accent);
    rootTable.style.setProperty("--bk-link-dark", brandKit.colors.link);
    rootTable.style.setProperty("--bk-button-text-dark", brandKit.colors.buttonText);

    rootTable.style.setProperty("--bk-text-light", "#0f172a");
    rootTable.style.setProperty("--bk-muted-light", "#475569");
    rootTable.style.setProperty("--bk-surface-light", "#ffffff");
    rootTable.style.setProperty("--bk-border-light", brandKit.colors.border);
    rootTable.style.setProperty("--bk-accent-light", brandKit.colors.accent);
    rootTable.style.setProperty("--bk-link-light", brandKit.colors.link);
    rootTable.style.setProperty("--bk-button-text-light", "#ffffff");
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
