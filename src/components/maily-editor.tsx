"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from "react";
import { Editor } from "@maily-to/core";
import {
  blockquote,
  bulletList,
  button,
  columns,
  divider,
  footer,
  heading1,
  heading2,
  heading3,
  image,
  linkCard,
  logo,
  orderedList,
  repeat,
  section,
  spacer,
  text,
  type BlockGroupItem
} from "@maily-to/core/blocks";
import { render } from "@maily-to/render";
import type { BrandKit } from "@/lib/brand-kits";

type MailyEditorProps = {
  value: string;
  contentJson?: Record<string, unknown>;
  refreshToken?: number;
  onChange: (next: {
    html: string;
    contentJson: Record<string, unknown>;
  }) => void;
  surfaceTheme?: "dark" | "light";
  brandKit?: BrandKit | null;
};

export type MailyEditorHandle = {
  flush: () => Promise<
    | {
        html: string;
        contentJson: Record<string, unknown>;
      }
    | null
  >;
};

function parseHexColor(input: string) {
  const trimmed = (input || "").trim();
  const short = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const expanded = short[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }

  const full = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (full) {
    return `#${full[1].toLowerCase()}`;
  }

  return null;
}

function getContrastButtonTextColor(accent: string) {
  const hex = parseHexColor(accent);
  if (!hex) {
    return "#041015";
  }

  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 150 ? "#041015" : "#ffffff";
}

function applyBrandDefaultsToSingleNode(
  node: Record<string, unknown>,
  brandKit: BrandKit
) {
  const type = typeof node.type === "string" ? node.type : "";
  const nextNode: Record<string, unknown> = { ...node };
  const attrs =
    node.attrs && typeof node.attrs === "object" && !Array.isArray(node.attrs)
      ? { ...(node.attrs as Record<string, unknown>) }
      : undefined;

  if (attrs) {
    if (type === "button") {
      const currentButtonColor = typeof attrs.buttonColor === "string" ? attrs.buttonColor : "";
      const currentTextColor = typeof attrs.textColor === "string" ? attrs.textColor : "";
      if (!currentButtonColor || currentButtonColor === "#000000") {
        attrs.buttonColor = brandKit.colors.accent;
      }
      if (!currentTextColor || currentTextColor === "#ffffff") {
        attrs.textColor =
          brandKit.colors.buttonText || getContrastButtonTextColor(brandKit.colors.accent);
      }
    }

    if (type === "section") {
      const currentBg = typeof attrs.backgroundColor === "string" ? attrs.backgroundColor : "";
      const currentBorder = typeof attrs.borderColor === "string" ? attrs.borderColor : "";
      if (!currentBg || currentBg === "#f7f7f7" || currentBg === "#ffffff") {
        attrs.backgroundColor = brandKit.colors.surface;
      }
      if (!currentBorder || currentBorder === "#e2e2e2" || currentBorder === "#000000") {
        attrs.borderColor = brandKit.colors.border;
      }
    }

    if (type === "logo") {
      const currentSrc = typeof attrs.src === "string" ? attrs.src : "";
      const currentAlt = typeof attrs.alt === "string" ? attrs.alt : "";
      const preferredLogoSrc = brandKit.iconUrl?.trim();
      if (
        preferredLogoSrc &&
        (!currentSrc || currentSrc === "https://maily.to/brand/logo.png")
      ) {
        attrs.src = preferredLogoSrc;
      }
      if (!currentAlt) {
        attrs.alt = `${brandKit.name} logo`;
      }
    }

    nextNode.attrs = attrs;
  }

  return nextNode;
}

function applyBrandKitDefaultsToNewNodes(
  currentNode: Record<string, unknown>,
  previousNode: Record<string, unknown> | undefined,
  brandKit: BrandKit
): Record<string, unknown> {
  const appliedCurrent = previousNode
    ? { ...currentNode }
    : applyBrandDefaultsToSingleNode(currentNode, brandKit);

  if (!Array.isArray(currentNode.content)) {
    return appliedCurrent;
  }

  const currentChildren = currentNode.content as Array<Record<string, unknown>>;
  const previousChildren =
    previousNode && Array.isArray(previousNode.content)
      ? (previousNode.content as Array<Record<string, unknown>>)
      : [];

  const nextChildren = currentChildren.map((child, index) =>
    applyBrandKitDefaultsToNewNodes(child, previousChildren[index], brandKit)
  );

  return {
    ...appliedCurrent,
    content: nextChildren
  };
}

function sanitizeRenderableMediaSources(
  node: Record<string, unknown>
): Record<string, unknown> {
  const nextNode: Record<string, unknown> = { ...node };
  const type = typeof node.type === "string" ? node.type : "";
  const attrs =
    node.attrs && typeof node.attrs === "object" && !Array.isArray(node.attrs)
      ? { ...(node.attrs as Record<string, unknown>) }
      : undefined;

  if (attrs && (type === "logo" || type === "image")) {
    const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
    if (!src) {
      delete attrs.src;
    } else {
      attrs.src = src;
    }

    if (type === "logo") {
      const alt = typeof attrs.alt === "string" ? attrs.alt.trim() : "";
      if (!alt) {
        attrs.alt = "Brand logo";
      }
    }

    nextNode.attrs = attrs;
  }

  if (Array.isArray(node.content)) {
    nextNode.content = (node.content as Array<Record<string, unknown>>).map((child) =>
      sanitizeRenderableMediaSources(child)
    );
  }

  return nextNode;
}

function hasMailyMarkerHtml(input: string) {
  return /data-maily-component\s*=/i.test(input);
}

function toJsonSignature(input: unknown) {
  if (!input) {
    return "";
  }

  try {
    return JSON.stringify(input);
  } catch {
    return "";
  }
}

type LinkCardAttrs = {
  mailyComponent: string;
  title: string;
  description: string;
  link: string;
  linkTitle: string;
  image: string;
  subTitle: string;
  badgeText: string;
};

const LINK_CARD_ATTR_DEFAULTS: LinkCardAttrs = {
  mailyComponent: "linkCard",
  title: "",
  description: "",
  link: "",
  linkTitle: "",
  image: "",
  subTitle: "",
  badgeText: ""
};

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function pickHtmlAttr(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = tag.match(pattern);
  const raw = match?.[2] ?? match?.[3];
  return typeof raw === "string" ? decodeHtmlAttribute(raw) : "";
}

function extractLinkCardAttrsFromRawHtml(rawHtml: string) {
  const tags =
    rawHtml.match(
      /<(?:a|div)\b[^>]*data-maily-component\s*=\s*("linkCard"|'linkCard')[^>]*>/gi
    ) ?? [];

  return tags.map(
    (tag): LinkCardAttrs => ({
      mailyComponent:
        pickHtmlAttr(tag, "mailycomponent") ||
        pickHtmlAttr(tag, "mailyComponent") ||
        LINK_CARD_ATTR_DEFAULTS.mailyComponent,
      title: pickHtmlAttr(tag, "title"),
      description: pickHtmlAttr(tag, "description"),
      link: pickHtmlAttr(tag, "link"),
      linkTitle: pickHtmlAttr(tag, "linktitle") || pickHtmlAttr(tag, "linkTitle"),
      image: pickHtmlAttr(tag, "image"),
      subTitle: pickHtmlAttr(tag, "subtitle") || pickHtmlAttr(tag, "subTitle"),
      badgeText: pickHtmlAttr(tag, "badgetext") || pickHtmlAttr(tag, "badgeText")
    })
  );
}

function normalizeLinkCardAttrs(input: unknown): LinkCardAttrs {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    mailyComponent:
      typeof source.mailyComponent === "string"
        ? source.mailyComponent
        : typeof source.mailycomponent === "string"
          ? source.mailycomponent
          : LINK_CARD_ATTR_DEFAULTS.mailyComponent,
    title:
      typeof source.title === "string" ? source.title : LINK_CARD_ATTR_DEFAULTS.title,
    description:
      typeof source.description === "string"
        ? source.description
        : LINK_CARD_ATTR_DEFAULTS.description,
    link:
      typeof source.link === "string"
        ? source.link
        : typeof source.href === "string"
          ? source.href
          : LINK_CARD_ATTR_DEFAULTS.link,
    linkTitle:
      typeof source.linkTitle === "string"
        ? source.linkTitle
        : typeof source.linktitle === "string"
          ? source.linktitle
          : LINK_CARD_ATTR_DEFAULTS.linkTitle,
    image:
      typeof source.image === "string"
        ? source.image
        : typeof source.src === "string"
          ? source.src
          : LINK_CARD_ATTR_DEFAULTS.image,
    subTitle:
      typeof source.subTitle === "string"
        ? source.subTitle
        : typeof source.subtitle === "string"
          ? source.subtitle
          : LINK_CARD_ATTR_DEFAULTS.subTitle,
    badgeText:
      typeof source.badgeText === "string"
        ? source.badgeText
        : typeof source.badgetext === "string"
          ? source.badgetext
          : LINK_CARD_ATTR_DEFAULTS.badgeText
  };
}

function isEmptyLinkCardAttrs(attrs: LinkCardAttrs) {
  return (
    !attrs.title.trim() &&
    !attrs.description.trim() &&
    !attrs.link.trim() &&
    !attrs.linkTitle.trim() &&
    !attrs.image.trim() &&
    !attrs.subTitle.trim() &&
    !attrs.badgeText.trim()
  );
}

function hydrateLinkCardAttrsFromRawHtml(
  node: Record<string, unknown>,
  htmlAttrs: LinkCardAttrs[],
  cursor: { index: number }
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...node };

  if (node.type === "linkCard") {
    const current = normalizeLinkCardAttrs(node.attrs);
    const fromHtml = htmlAttrs[cursor.index];
    if (fromHtml) {
      cursor.index += 1;
      next.attrs = isEmptyLinkCardAttrs(current) ? { ...current, ...fromHtml } : current;
    } else {
      next.attrs = current;
    }
  }

  if (Array.isArray(node.content)) {
    next.content = (node.content as Array<unknown>).map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return entry as unknown;
      }
      return hydrateLinkCardAttrsFromRawHtml(
        entry as Record<string, unknown>,
        htmlAttrs,
        cursor
      );
    });
  }

  return next;
}

function createBlocks(brandKit: BrandKit | null | undefined): BlockGroupItem[] {
  const buttonWithBrandDefaults: any = {
    ...button,
    command: (options: { editor: any; range: any }) => {
      const baseCommand = "command" in button ? button.command : undefined;
      if (!baseCommand) {
        return;
      }
      baseCommand(options);
      if (!brandKit) {
        return;
      }
      options.editor.commands.updateButton({
        buttonColor: brandKit.colors.accent,
        textColor: brandKit.colors.buttonText
      });
    }
  };

  const sectionWithBrandDefaults: any = {
    ...section,
    command: (options: { editor: any; range: any }) => {
      const baseCommand = "command" in section ? section.command : undefined;
      if (!baseCommand) {
        return;
      }
      baseCommand(options);
      if (!brandKit) {
        return;
      }
      options.editor.commands.updateSection({
        backgroundColor: brandKit.colors.surface,
        borderColor: brandKit.colors.border
      });
    }
  };

  const logoWithBrandDefaults: any = {
    ...logo,
    command: (options: { editor: any; range: any }) => {
      const preferredLogoSrc = brandKit?.iconUrl?.trim();
      if (preferredLogoSrc) {
        const brandName = brandKit?.name ?? "Brand";
        options.editor.chain().focus().deleteRange(options.range).setLogoImage({
          src: preferredLogoSrc,
          alt: `${brandName} logo`
        }).run();
        return;
      }

      const baseCommand = "command" in logo ? logo.command : undefined;
      if (baseCommand) {
        baseCommand(options);
      }
    }
  };

  return [
    {
      title: "Text",
      commands: [
        text,
        heading1,
        heading2,
        heading3,
        bulletList,
        orderedList,
        blockquote,
        footer
      ]
    },
    {
      title: "Layout",
      commands: [sectionWithBrandDefaults as any, columns, spacer, divider, repeat]
    },
    {
      title: "Media",
      commands: [logoWithBrandDefaults as any, image]
    },
    {
      title: "Actions",
      commands: [buttonWithBrandDefaults as any, linkCard]
    }
  ];
}

export const MailyEditor = forwardRef<MailyEditorHandle, MailyEditorProps>(function MailyEditor(
  {
    value,
    contentJson,
    refreshToken = 0,
    onChange,
    surfaceTheme = "light",
    brandKit
  },
  ref
) {
  const blocks = useMemo(() => createBlocks(brandKit), [brandKit]);
  const editorRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const lastEditorContentRef = useRef<Record<string, unknown> | undefined>(
    contentJson && Object.keys(contentJson).length > 0 ? contentJson : undefined
  );
  const editorKey = `${surfaceTheme}:${brandKit?.id ?? "no-kit"}:${refreshToken}`;

  const initialHtml = (value || "").trim();
  const lastEmittedHtmlRef = useRef(
    initialHtml && !hasMailyMarkerHtml(initialHtml) ? initialHtml : ""
  );
  const latestRenderSignatureRef = useRef("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const normalizedValue = (value || "").trim();
    if (normalizedValue && !hasMailyMarkerHtml(normalizedValue)) {
      lastEmittedHtmlRef.current = normalizedValue;
    }
  }, [value]);

  useEffect(() => {
    lastEditorContentRef.current =
      contentJson && Object.keys(contentJson).length > 0 ? contentJson : undefined;
  }, [contentJson, refreshToken]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getNormalizedJsonFromEditor = useCallback(
    (editorInstance: any) => {
      const nextJson = editorInstance.getJSON?.();
      if (!nextJson || typeof nextJson !== "object") {
        return null;
      }

      const previousJson = lastEditorContentRef.current;
      const withBrandDefaults = brandKit
        ? applyBrandKitDefaultsToNewNodes(
            nextJson as Record<string, unknown>,
            previousJson,
            brandKit
          )
        : (nextJson as Record<string, unknown>);
      const normalizedJson = sanitizeRenderableMediaSources(withBrandDefaults);
      const rawHtml =
        typeof editorInstance.getHTML === "function" ? editorInstance.getHTML() : "";

      if (typeof rawHtml === "string" && hasMailyMarkerHtml(rawHtml)) {
        return hydrateLinkCardAttrsFromRawHtml(
          normalizedJson,
          extractLinkCardAttrsFromRawHtml(rawHtml),
          { index: 0 }
        );
      }

      return normalizedJson;
    },
    [brandKit]
  );

  const renderHtmlFromJson = useCallback(
    async (json: Record<string, unknown>) => {
      return render(json);
    },
    []
  );

  const emitFromEditor = useCallback(
    async (editorInstance: any) => {
      if (!editorInstance) {
        return null;
      }

      const normalizedJson = getNormalizedJsonFromEditor(editorInstance);
      if (!normalizedJson) {
        return null;
      }

      const signature = toJsonSignature(normalizedJson);
      latestRenderSignatureRef.current = signature;

      const immediateHtmlRaw =
        typeof editorInstance.getHTML === "function" ? editorInstance.getHTML() : "";
      const immediateHtml =
        typeof immediateHtmlRaw === "string" ? immediateHtmlRaw : "";
      if (immediateHtml.trim().length > 0) {
        lastEditorContentRef.current = normalizedJson;
        onChangeRef.current({
          html: immediateHtml,
          contentJson: normalizedJson
        });
      }

      try {
        const normalizedHtml = await renderHtmlFromJson(normalizedJson);
        if (!isMountedRef.current || latestRenderSignatureRef.current !== signature) {
          return null;
        }

        lastEditorContentRef.current = normalizedJson;
        lastEmittedHtmlRef.current = normalizedHtml.trim();

        onChangeRef.current({
          html: normalizedHtml,
          contentJson: normalizedJson
        });

        return {
          html: normalizedHtml,
          contentJson: normalizedJson
        };
      } catch {
        const fallbackHtmlRaw =
          typeof editorInstance.getHTML === "function"
            ? editorInstance.getHTML()
            : lastEmittedHtmlRef.current;
        const fallbackHtml =
          typeof fallbackHtmlRaw === "string" ? fallbackHtmlRaw : "";
        const fallbackFromProp = typeof value === "string" ? value : "";
        const lastKnownHtml =
          typeof lastEmittedHtmlRef.current === "string"
            ? lastEmittedHtmlRef.current
            : "";
        const safeFallbackHtml =
          fallbackHtml.trim().length > 0
            ? fallbackHtml
            : lastKnownHtml.trim().length > 0
              ? lastKnownHtml
              : fallbackFromProp.trim().length > 0
                ? fallbackFromProp
                : "";

        if (!isMountedRef.current || latestRenderSignatureRef.current !== signature) {
          return null;
        }

        lastEditorContentRef.current = normalizedJson;
        lastEmittedHtmlRef.current = safeFallbackHtml.trim();
        onChangeRef.current({
          html: safeFallbackHtml,
          contentJson: normalizedJson
        });

        return {
          html: safeFallbackHtml,
          contentJson: normalizedJson
        };
      }
    },
    [getNormalizedJsonFromEditor, renderHtmlFromJson, value]
  );

  const handleEditorCreate = useCallback(
    (editorInstance: any) => {
      editorRef.current = editorInstance;
    },
    []
  );

  useImperativeHandle(
    ref,
    () => ({
      flush: async () => {
        if (!editorRef.current) {
          return null;
        }
        const editorInstance = editorRef.current;
        const normalizedJson = getNormalizedJsonFromEditor(editorInstance);
        if (!normalizedJson) {
          return null;
        }

        try {
          const normalizedHtml = await renderHtmlFromJson(normalizedJson);
          lastEditorContentRef.current = normalizedJson;
          lastEmittedHtmlRef.current = normalizedHtml.trim();
          onChangeRef.current({
            html: normalizedHtml,
            contentJson: normalizedJson
          });
          return {
            html: normalizedHtml,
            contentJson: normalizedJson
          };
        } catch {
          return null;
        }
      }
    }),
    [getNormalizedJsonFromEditor, renderHtmlFromJson]
  );

  return (
    <div
      className={`maily-editor-shell overflow-hidden rounded-xl p-3 ${
        surfaceTheme === "dark"
          ? "maily-editor-shell-dark border border-white/15 bg-slate-950/40"
          : "maily-editor-shell-light border border-slate-300 bg-white"
      }`}
      style={
        {
          "--ses-editor-accent": brandKit?.colors.accent ?? "#22d3ee",
          "--ses-editor-accent-foreground":
            brandKit?.colors.buttonText ||
            getContrastButtonTextColor(brandKit?.colors.accent ?? "#22d3ee")
        } as Record<string, string>
      }
    >
      <Editor
        key={editorKey}
        blocks={blocks}
        config={{
          bodyClassName:
            surfaceTheme === "dark"
              ? "mly:border-gray-700 mly:bg-gray-900"
              : "mly:border-gray-200 mly:bg-white",
          contentClassName:
            surfaceTheme === "dark" ? "mly:text-gray-50" : "mly:text-black",
          wrapClassName: "mly:w-full"
        }}
        contentHtml={
          contentJson && Object.keys(contentJson).length > 0
            ? undefined
            : value || "<p>Hello {{name}}, welcome to {{company}}.</p>"
        }
        contentJson={contentJson as any}
        onCreate={handleEditorCreate}
        onUpdate={emitFromEditor}
      />
    </div>
  );
});
