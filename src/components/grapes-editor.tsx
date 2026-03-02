"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@heroui/react";
import {
  Columns2,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  List,
  Minus,
  RectangleEllipsis,
  Type
} from "lucide-react";
import type { BrandKit } from "@/lib/brand-kits";
import { toTableEmailHtml } from "@/lib/html-utils";

type GrapesEditorProps = {
  value: string;
  onChange: (html: string) => void;
  theme?: "dark" | "light";
  brandKit?: BrandKit | null;
};

type InspectorState = {
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  href: string;
  src: string;
  alt: string;
};

const BLOCK_ROW_MIME = "application/x-ses-email-row";
const SELECTABLE = "a,td,p,div,h1,h2,h3,h4,h5,h6,img,hr,ul,ol,li,table,tr,span,section,article";
const PRESET_COLORS = [
  "#f8fafc",
  "#cbd5e1",
  "#64748b",
  "#0f172a",
  "#22d3ee",
  "#2563eb",
  "#7c3aed",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#84cc16",
  "#10b981"
];

function createBlocks(brandKit: BrandKit | null | undefined) {
  const accent = brandKit?.colors.accent ?? "currentColor";
  const text = brandKit?.colors.text ?? "inherit";
  const buttonText = brandKit?.colors.buttonText ?? "inherit";
  const border = brandKit?.colors.border ?? "currentColor";
  const imageSrc = "https://placehold.co/640x240";
  const logoSrc =
    brandKit?.iconUrl ?? "https://placehold.co/220x70/111827/ffffff?text=Logo";
  const logoAlt = brandKit?.name ? `${brandKit.name} logo` : "Brand logo";

  return [
    {
      label: "Hero",
      icon: LayoutTemplate,
      row:
        `<tr><td style='padding:28px 24px;font-family:inherit;color:${text}'><h1 style='margin:0 0 10px;font-size:28px;line-height:1.2;color:${text}'>Welcome {{name}}</h1><p style='margin:0;font-size:16px;line-height:1.5;color:${text}'>We are excited to have you at {{company}}.</p></td></tr>`
    },
    {
      label: "Paragraph",
      icon: Type,
      row:
        `<tr><td style='padding:16px 24px;font-family:inherit;color:${text};font-size:15px;line-height:1.6'>Write your campaign message here.</td></tr>`
    },
    {
      label: "Button",
      icon: RectangleEllipsis,
      row:
        `<tr><td style='padding:8px 24px 20px'><a href='#' style='display:inline-block;padding:12px 18px;border-radius:8px;border:1px solid ${accent};background:${accent};color:${buttonText};text-decoration:none;font-family:inherit;font-size:14px'>Call To Action</a></td></tr>`
    },
    {
      label: "Link",
      icon: Link2,
      row:
        `<tr><td style='padding:8px 24px;font-family:inherit'><a href='#' style='color:${accent};text-decoration:underline;font-size:14px'>Read more</a></td></tr>`
    },
    {
      label: "Logo",
      icon: ImageIcon,
      row:
        `<tr><td style='padding:12px 24px'><img alt='${logoAlt}' src='${logoSrc}' style='display:block;max-width:220px;width:auto;height:auto;border:0' /></td></tr>`
    },
    {
      label: "Image",
      icon: ImageIcon,
      row:
        `<tr><td style='padding:8px 24px'><img alt='Brand icon' src='${imageSrc}' style='display:block;width:100%;height:auto;border:0;border-radius:10px' /></td></tr>`
    },
    {
      label: "Divider",
      icon: Minus,
      row:
        `<tr><td style='padding:18px 24px'><hr style='border:none;border-top:1px solid ${border};opacity:.35;margin:0' /></td></tr>`
    },
    {
      label: "2 Columns",
      icon: Columns2,
      row:
        `<tr><td style='padding:10px 24px'><table role='presentation' width='100%' cellspacing='0' cellpadding='0' border='0' style='border-collapse:collapse'><tr><td width='50%' style='padding-right:8px;vertical-align:top;font-family:inherit;color:${text}'>Left column content</td><td width='50%' style='padding-left:8px;vertical-align:top;font-family:inherit;color:${text}'>Right column content</td></tr></table></td></tr>`
    },
    {
      label: "List",
      icon: List,
      row:
        `<tr><td style='padding:8px 24px;font-family:inherit;color:${text}'><ul style='margin:0;padding-left:20px'><li style='margin:0 0 6px'>First point</li><li style='margin:0 0 6px'>Second point</li><li style='margin:0'>Third point</li></ul></td></tr>`
    },
    {
      label: "Spacer",
      icon: Type,
      row: "<tr><td style='height:24px;font-size:0;line-height:0'>&nbsp;</td></tr>"
    }
  ];
}

function appendRow(html: string, rowSnippet: string) {
  const normalized = toTableEmailHtml(html);
  const container = document.createElement("div");
  container.innerHTML = normalized;

  const rootTable = container.querySelector("table");
  if (!rootTable) {
    return toTableEmailHtml(rowSnippet);
  }

  const rootBody = rootTable.tBodies[0] ?? rootTable.createTBody();
  rootBody.insertAdjacentHTML("beforeend", rowSnippet);
  return container.innerHTML;
}

function insertRowAtDropPosition(
  editor: HTMLDivElement,
  rowSnippet: string,
  clientY: number
) {
  const rootTable = editor.querySelector("table");
  if (!rootTable) {
    const merged = appendRow(editor.innerHTML, rowSnippet);
    editor.innerHTML = merged;
    return merged;
  }

  const rootBody = rootTable.tBodies[0] ?? rootTable.createTBody();
  const rows = Array.from(rootBody.rows);

  if (rows.length === 0) {
    rootBody.insertAdjacentHTML("beforeend", rowSnippet);
    return editor.innerHTML;
  }

  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (clientY < rect.top) {
      row.insertAdjacentHTML("beforebegin", rowSnippet);
      return editor.innerHTML;
    }
    if (clientY <= rect.bottom) {
      const insertBefore = clientY < rect.top + rect.height / 2;
      row.insertAdjacentHTML(insertBefore ? "beforebegin" : "afterend", rowSnippet);
      return editor.innerHTML;
    }
  }

  rows[rows.length - 1]?.insertAdjacentHTML("afterend", rowSnippet);
  return editor.innerHTML;
}

function toHexColor(value: string, fallback: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return fallback;
  }

  const shortHex = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    return `#${shortHex[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`.toLowerCase();
  }

  const hex = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return `#${hex[1].toLowerCase()}`;
  }

  const rgb = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    const r = Number(rgb[1]).toString(16).padStart(2, "0");
    const g = Number(rgb[2]).toString(16).padStart(2, "0");
    const b = Number(rgb[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  return fallback;
}

function toPxNumber(value: string, fallback: number) {
  const parsed = Number.parseInt((value || "").replace("px", ""), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeHex(value: string) {
  const trimmed = value.trim();
  const short = trimmed.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  const full = trimmed.match(/^#?([0-9a-f]{6})$/i);
  if (full) {
    return `#${full[1].toLowerCase()}`;
  }

  return null;
}

function hexToHsl(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? "#64748b";
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
  }

  const hue = Math.round((h * 60 + 360) % 360);
  const sat = Math.round(s * 100);
  const light = Math.round(l * 100);
  return [hue, sat, light];
}

function hslToHex(h: number, s: number, l: number) {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
};

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const normalized = normalizeHex(value) ?? "#64748b";
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(normalized);
  const [h, s, l] = hexToHsl(normalized);

  useEffect(() => {
    setHexInput(normalized);
  }, [normalized]);

  return (
    <div className="relative rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-300">
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span
            className="h-5 w-5 rounded border border-white/30"
            style={{ backgroundColor: normalized }}
          />
          <code className="font-mono text-[11px] text-slate-300">{normalized}</code>
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-60 rounded-xl border border-white/15 bg-slate-950/95 p-3 shadow-2xl">
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                className="h-6 w-6 rounded border border-white/20"
                style={{ backgroundColor: preset }}
                title={preset}
                type="button"
                onClick={() => onChange(preset)}
              />
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <label className="block text-[11px] text-slate-400">Hue</label>
            <input
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-transparent"
              max={360}
              min={0}
              style={{
                background:
                  "linear-gradient(90deg,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%)"
              }}
              type="range"
              value={h}
              onChange={(event) => {
                const nextHue = Number.parseInt(event.currentTarget.value, 10);
                onChange(hslToHex(nextHue, s, l));
              }}
            />
          </div>

          <Input
            className="mt-3"
            label="Hex"
            size="sm"
            value={hexInput}
            onValueChange={(next) => {
              setHexInput(next);
              const normalizedNext = normalizeHex(next);
              if (normalizedNext) {
                onChange(normalizedNext);
              }
            }}
          />

          <div className="mt-3 flex justify-end">
            <Button size="sm" type="button" variant="flat" onPress={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function readInspectorState(element: HTMLElement): InspectorState {
  const paddingTarget =
    element.tagName.toLowerCase() === "img"
      ? (element.closest("td") as HTMLElement | null) ?? element
      : element;
  const computed = window.getComputedStyle(element);
  const computedPadding = window.getComputedStyle(paddingTarget);
  const tag = element.tagName.toLowerCase();
  const anchor = tag === "a" ? (element as HTMLAnchorElement) : null;
  const image = tag === "img" ? (element as HTMLImageElement) : null;

  const paddingLeft = toPxNumber(
    paddingTarget.style.paddingLeft || computedPadding.paddingLeft,
    0
  );
  const paddingTop = toPxNumber(
    paddingTarget.style.paddingTop || computedPadding.paddingTop,
    0
  );
  const marginLeft = toPxNumber(
    paddingTarget.style.marginLeft || computedPadding.marginLeft,
    0
  );
  const marginTop = toPxNumber(
    paddingTarget.style.marginTop || computedPadding.marginTop,
    0
  );

  return {
    textColor: toHexColor(element.style.color || computed.color, "#94a3b8"),
    backgroundColor: toHexColor(
      element.style.backgroundColor || computed.backgroundColor,
      "#0f172a"
    ),
    borderColor: toHexColor(
      element.style.borderColor || computed.borderColor,
      "#64748b"
    ),
    borderRadius: toPxNumber(element.style.borderRadius || computed.borderRadius, 0),
    // CSS doesn't support negative padding. For negative spacing we use margin.
    paddingX: paddingLeft > 0 ? paddingLeft : marginLeft,
    paddingY: paddingTop > 0 ? paddingTop : marginTop,
    href: anchor?.getAttribute("href") ?? "",
    src: image?.getAttribute("src") ?? "",
    alt: image?.getAttribute("alt") ?? ""
  };
}

function getRadiusTarget(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  if (tag === "td") {
    const directAnchor = element.querySelector(":scope > a");
    if (directAnchor instanceof HTMLAnchorElement) {
      return directAnchor;
    }

    const directImage = element.querySelector(":scope > img");
    if (directImage instanceof HTMLImageElement) {
      return directImage;
    }
  }

  return element;
}

export function GrapesEditor({
  value,
  onChange,
  theme = "dark",
  brandKit
}: GrapesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);
  const isTypingRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [inspector, setInspector] = useState<InspectorState | null>(null);
  const blocks = useMemo(() => createBlocks(brandKit), [brandKit]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const isEditorFocused = document.activeElement === editor;
    if (isTypingRef.current && isEditorFocused) {
      return;
    }

    const normalizedIncoming = toTableEmailHtml(value);
    if (editor.innerHTML !== normalizedIncoming) {
      editor.innerHTML = normalizedIncoming;
    }
  }, [value]);

  const commitEditor = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onChange(editor.innerHTML);
  };

  const updateSelection = (node: Node | null) => {
    const editor = editorRef.current;
    if (!editor || !node) {
      selectedElementRef.current = null;
      setSelectedTag(null);
      setInspector(null);
      return;
    }

    let element: HTMLElement | null =
      node instanceof HTMLElement ? node : node.parentElement;

    while (element && element !== editor && !element.matches(SELECTABLE)) {
      element = element.parentElement;
    }

    if (!element || element === editor || !editor.contains(element)) {
      selectedElementRef.current = null;
      setSelectedTag(null);
      setInspector(null);
      return;
    }

    selectedElementRef.current = element;
    setSelectedTag(element.tagName.toLowerCase());
    setInspector(readInspectorState(element));
  };

  const refreshSelectionFromCaret = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    updateSelection(selection.anchorNode);
  };

  const applyToSelected = (mutate: (element: HTMLElement) => void) => {
    const element = selectedElementRef.current;
    if (!element) {
      return;
    }
    mutate(element);
    element.setAttribute("data-editor-style-lock", "true");
    setInspector(readInspectorState(element));
    commitEditor();
  };

  const insertRow = (snippet: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const merged = appendRow(editor.innerHTML, snippet);
    editor.innerHTML = merged;
    onChange(merged);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/15 bg-black/30 p-2">
        <div className="flex flex-wrap gap-2">
          {blocks.map(({ label, icon: Icon, row }) => (
            <Button
              draggable
              key={label}
              onDragStart={(event) => {
                event.dataTransfer.setData(BLOCK_ROW_MIME, row);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onPress={() => insertRow(row)}
              size="sm"
              startContent={<Icon className="h-3.5 w-3.5" />}
              type="button"
              variant="flat"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/15 bg-black/20 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs">
          <p className="text-slate-300">
            {selectedTag
              ? `Selected: <${selectedTag}>`
              : "Select an element in the canvas to edit its styles"}
          </p>
          {selectedTag ? (
            <Button
              size="sm"
              type="button"
              variant="flat"
              onPress={() =>
                applyToSelected((element) => {
                  element.style.color = "";
                  element.style.backgroundColor = "";
                  element.style.borderColor = "";
                  element.style.borderRadius = "";
                  element.style.paddingTop = "";
                  element.style.paddingBottom = "";
                  element.style.paddingLeft = "";
                  element.style.paddingRight = "";
                  element.style.marginTop = "";
                  element.style.marginBottom = "";
                  element.style.marginLeft = "";
                  element.style.marginRight = "";
                  element.removeAttribute("data-editor-style-lock");
                })
              }
            >
              Reset Style
            </Button>
          ) : null}
        </div>

        {inspector ? (
          <div className="grid gap-3 md:grid-cols-3">
            <ColorField
              label="Text"
              value={inspector.textColor}
              onChange={(next) =>
                applyToSelected((element) => {
                  element.style.color = next;
                  if (element.tagName.toLowerCase() === "td") {
                    const directAnchor = element.querySelector(":scope > a");
                    if (directAnchor instanceof HTMLAnchorElement) {
                      directAnchor.style.color = next;
                      directAnchor.setAttribute("data-editor-style-lock", "true");
                    }
                  }
                })
              }
            />
            <ColorField
              label="Background"
              value={inspector.backgroundColor}
              onChange={(next) =>
                applyToSelected((element) => {
                  element.style.backgroundColor = next;
                })
              }
            />
            <ColorField
              label="Border"
              value={inspector.borderColor}
              onChange={(next) =>
                applyToSelected((element) => {
                  element.style.borderColor = next;
                })
              }
            />

            <Input
              label="Radius (px)"
              size="sm"
              type="number"
              value={String(inspector.borderRadius)}
              onValueChange={(value) =>
                applyToSelected((element) => {
                  const px = Number.parseInt(value || "0", 10) || 0;
                  const target = getRadiusTarget(element);
                  target.style.borderRadius = `${Math.max(0, px)}px`;
                  target.setAttribute("data-editor-style-lock", "true");
                })
              }
            />
            <Input
              label="Padding X (px)"
              size="sm"
              type="number"
              value={String(inspector.paddingX)}
              onValueChange={(value) =>
                applyToSelected((element) => {
                  const parsed = Number.parseInt(value || "0", 10);
                  const px = Number.isNaN(parsed) ? 0 : parsed;
                  const target =
                    element.tagName.toLowerCase() === "img"
                      ? (element.closest("td") as HTMLElement | null) ?? element
                      : element;
                  if (px < 0) {
                    target.style.paddingLeft = "0px";
                    target.style.paddingRight = "0px";
                    target.style.marginLeft = `${px}px`;
                    target.style.marginRight = `${px}px`;
                  } else {
                    target.style.marginLeft = "0px";
                    target.style.marginRight = "0px";
                    target.style.paddingLeft = `${px}px`;
                    target.style.paddingRight = `${px}px`;
                  }
                  target.setAttribute("data-editor-style-lock", "true");
                })
              }
            />
            <Input
              label="Padding Y (px)"
              size="sm"
              type="number"
              value={String(inspector.paddingY)}
              onValueChange={(value) =>
                applyToSelected((element) => {
                  const parsed = Number.parseInt(value || "0", 10);
                  const px = Number.isNaN(parsed) ? 0 : parsed;
                  const target =
                    element.tagName.toLowerCase() === "img"
                      ? (element.closest("td") as HTMLElement | null) ?? element
                      : element;
                  if (px < 0) {
                    target.style.paddingTop = "0px";
                    target.style.paddingBottom = "0px";
                    target.style.marginTop = `${px}px`;
                    target.style.marginBottom = `${px}px`;
                  } else {
                    target.style.marginTop = "0px";
                    target.style.marginBottom = "0px";
                    target.style.paddingTop = `${px}px`;
                    target.style.paddingBottom = `${px}px`;
                  }
                  target.setAttribute("data-editor-style-lock", "true");
                })
              }
            />

            {selectedTag === "a" ? (
              <Input
                className="md:col-span-3"
                label="Link URL"
                size="sm"
                value={inspector.href}
                onValueChange={(value) =>
                  applyToSelected((element) => {
                    (element as HTMLAnchorElement).setAttribute("href", value || "#");
                  })
                }
              />
            ) : null}

            {selectedTag === "img" ? (
              <>
                <Input
                  className="md:col-span-2"
                  label="Image URL"
                  size="sm"
                  value={inspector.src}
                  onValueChange={(value) =>
                    applyToSelected((element) => {
                      (element as HTMLImageElement).setAttribute("src", value);
                    })
                  }
                />
                <Input
                  label="Alt Text"
                  size="sm"
                  value={inspector.alt}
                  onValueChange={(value) =>
                    applyToSelected((element) => {
                      (element as HTMLImageElement).setAttribute("alt", value);
                    })
                  }
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`overflow-hidden rounded-xl ${
          theme === "dark" ? "border border-white/15" : "border border-slate-300"
        }`}
      >
        <div
          data-editor-theme={theme}
          className={`email-surface min-h-[460px] p-4 text-sm outline-none ${
            theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-white text-black"
          } ${isDragOver ? "ring-2 ring-cyan-400/70 ring-inset" : ""}`}
          contentEditable
          onClick={(event) => updateSelection(event.target as Node)}
          onDragLeave={() => setIsDragOver(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            const dropped = event.dataTransfer.getData(BLOCK_ROW_MIME);
            if (!dropped) {
              return;
            }
            const editor = editorRef.current;
            if (!editor) {
              return;
            }
            const merged = insertRowAtDropPosition(editor, dropped, event.clientY);
            onChange(merged);
          }}
          onBlur={() => {
            const editor = editorRef.current;
            if (editor) {
              const normalized = toTableEmailHtml(editor.innerHTML);
              if (normalized !== editor.innerHTML) {
                editor.innerHTML = normalized;
              }
              onChange(normalized);
            }
            isTypingRef.current = false;
          }}
          onInput={(event) => {
            isTypingRef.current = true;
            onChange(toTableEmailHtml((event.currentTarget as HTMLDivElement).innerHTML));
          }}
          onKeyUp={refreshSelectionFromCaret}
          onMouseUp={refreshSelectionFromCaret}
          ref={editorRef}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
