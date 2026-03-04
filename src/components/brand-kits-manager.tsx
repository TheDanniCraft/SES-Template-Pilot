"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Switch
} from "@heroui/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBrandKitAction,
  saveBrandKitAction
} from "@/lib/actions/brand-kits";
import {
  type BrandKit,
  type BrandKitColorValues
} from "@/lib/brand-kits";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";

type BrandKitsManagerProps = {
  initialKits: BrandKit[];
};

type BrandKitDraft = BrandKit & {
  localId: string;
};

type BrandColorKey = keyof BrandKitColorValues;

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
  "#10b981",
  "#5f06f5"
] as const;

const COLOR_FIELDS: Array<{
  key: BrandColorKey;
  label: string;
}> = [
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "surface", label: "Surface" },
  { key: "border", label: "Border" },
  { key: "accent", label: "Accent" },
  { key: "link", label: "Link" },
  { key: "buttonText", label: "Button Text" }
];

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

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return "00000000-0000-4000-8000-000000000000";
}

function toDraft(kit: BrandKit): BrandKitDraft {
  const colorsWithoutLegacyLight = { ...kit.colors };
  delete colorsWithoutLegacyLight.light;
  return {
    ...kit,
    colors: colorsWithoutLegacyLight,
    localId: kit.id
  };
}

type BrandColorFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
};

function BrandColorField({ label, value, onChange }: BrandColorFieldProps) {
  const normalized = normalizeHex(value) ?? "#64748b";
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(normalized);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<{ left: number; top: number } | null>(null);
  const [h, s, l] = hexToHsl(normalized);

  useEffect(() => {
    setHexInput(normalized);
  }, [normalized]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 10;
      const popoverWidth = 256;
      const measuredHeight = popoverRef.current?.offsetHeight ?? 360;

      const left = Math.max(
        viewportPadding,
        Math.min(
          triggerRect.left,
          window.innerWidth - popoverWidth - viewportPadding
        )
      );

      let top = triggerRect.top - measuredHeight - gap;
      if (top < viewportPadding) {
        top = Math.min(
          triggerRect.bottom + gap,
          window.innerHeight - measuredHeight - viewportPadding
        );
      }

      setPopoverStyle({ left, top });
    };

    updatePopoverPosition();
    const raf = window.requestAnimationFrame(updatePopoverPosition);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInPopover = popoverRef.current?.contains(target);
      const clickedTrigger = triggerRef.current?.contains(target);
      if (!clickedInPopover && !clickedTrigger) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <button
        ref={triggerRef}
        className="flex w-full items-center justify-between gap-2 text-left"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="text-xs text-slate-300">{label}</span>
        <span className="flex items-center gap-2">
          <span
            className="h-5 w-5 rounded border border-white/30"
            style={{ backgroundColor: normalized }}
          />
          <code className="font-mono text-[11px] text-slate-300">{normalized}</code>
        </span>
      </button>

      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[120] w-64 rounded-xl border border-white/15 bg-slate-950/95 p-3 shadow-2xl"
              style={{
                left: `${popoverStyle.left}px`,
                top: `${popoverStyle.top}px`
              }}
            >
              <div className="grid grid-cols-7 gap-1.5">
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

              <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-slate-400">Saturation</label>
                <input
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-transparent"
                  max={100}
                  min={0}
                  style={{
                    background: `linear-gradient(90deg, ${hslToHex(h, 0, l)} 0%, ${hslToHex(h, 100, l)} 100%)`
                  }}
                  type="range"
                  value={s}
                  onChange={(event) => {
                    const nextSat = Number.parseInt(event.currentTarget.value, 10);
                    onChange(hslToHex(h, nextSat, l));
                  }}
                />
              </div>

              <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-slate-400">Lightness</label>
                <input
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-transparent"
                  max={100}
                  min={0}
                  style={{
                    background: `linear-gradient(90deg, #000000 0%, ${hslToHex(h, s, 50)} 50%, #ffffff 100%)`
                  }}
                  type="range"
                  value={l}
                  onChange={(event) => {
                    const nextLight = Number.parseInt(event.currentTarget.value, 10);
                    onChange(hslToHex(h, s, nextLight));
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

const DEFAULT_BASE_COLORS: BrandKitColorValues = {
  text: "#0f172a",
  muted: "#475569",
  surface: "#ffffff",
  border: "#e2e8f0",
  accent: "#5f06f5",
  link: "#5f06f5",
  buttonText: "#ffffff"
};

function getBaseColors(colors: BrandKit["colors"]): BrandKitColorValues {
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

function createDarkVariant(base: BrandKitColorValues): BrandKitColorValues {
  return { ...base };
}

function createEmptyKit(): BrandKitDraft {
  const id = createLocalId();
  return {
    id,
    localId: id,
    name: "New Brand Kit",
    iconUrl: "https://placehold.co/80x80/111827/ffffff?text=BK",
    colors: { ...DEFAULT_BASE_COLORS }
  };
}

export function BrandKitsManager({ initialKits }: BrandKitsManagerProps) {
  const [kits, setKits] = useState<BrandKitDraft[]>(() => initialKits.map(toDraft));
  const [isPending, startTransition] = useTransition();

  const updateKit = (index: number, next: BrandKitDraft) => {
    setKits((current) => current.map((item, i) => (i === index ? next : item)));
  };

  const updateBaseColor = (
    index: number,
    key: BrandColorKey,
    value: string
  ) => {
    const kit = kits[index];
    if (!kit) {
      return;
    }

    updateKit(index, {
      ...kit,
      colors: {
        ...kit.colors,
        [key]: value
      }
    });
  };

  const updateVariantColor = (
    index: number,
    mode: "dark",
    key: BrandColorKey,
    value: string
  ) => {
    const kit = kits[index];
    if (!kit) {
      return;
    }

    const variant = kit.colors[mode];
    if (!variant) {
      return;
    }

    updateKit(index, {
      ...kit,
      colors: {
        ...kit.colors,
        [mode]: {
          ...variant,
          [key]: value
        }
      }
    });
  };

  const setVariantEnabled = (
    index: number,
    mode: "dark",
    enabled: boolean
  ) => {
    const kit = kits[index];
    if (!kit) {
      return;
    }

    const base = getBaseColors(kit.colors);
    if (!enabled) {
      const nextColors = { ...kit.colors };
      delete nextColors[mode];
      updateKit(index, {
        ...kit,
        colors: nextColors
      });
      return;
    }

    updateKit(index, {
      ...kit,
      colors: {
        ...kit.colors,
        [mode]: createDarkVariant(base)
      }
    });
  };

  const onSave = useCallback((kit: BrandKitDraft) => {
    startTransition(async () => {
      const result = await saveBrandKitAction({
        id: kit.id,
        name: kit.name,
        iconUrl: kit.iconUrl,
        colors: kit.colors
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Saved brand kit "${kit.name}"`);
    });
  }, [startTransition]);

  const onDelete = (kit: BrandKitDraft) => {
    startTransition(async () => {
      const result = await deleteBrandKitAction(kit.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setKits((current) => current.filter((item) => item.localId !== kit.localId));
      toast.success(`Deleted "${kit.name}"`);
    });
  };

  const onSaveShortcut = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const localId =
      activeElement
        ?.closest<HTMLElement>("[data-brand-kit-local-id]")
        ?.getAttribute("data-brand-kit-local-id") ?? null;

    const targetKit = localId
      ? kits.find((kit) => kit.localId === localId)
      : kits.length === 1
        ? kits[0]
        : null;

    if (!targetKit) {
      return;
    }

    onSave(targetKit);
  }, [kits, onSave]);

  useSaveShortcut(onSaveShortcut, !isPending && kits.length > 0);

  return (
    <div className="space-y-4">
      <Card className="panel rounded-2xl">
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Brand</p>
            <h1 className="text-xl font-semibold">Manage Brand Kits</h1>
          </div>
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            type="button"
            onPress={() => setKits((current) => [...current, createEmptyKit()])}
          >
            New Kit
          </Button>
        </CardHeader>
      </Card>

      {kits.map((kit, index) => (
        <Card
          key={kit.localId}
          className="panel rounded-2xl"
          data-brand-kit-local-id={kit.localId}
        >
          <CardBody className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Name"
                value={kit.name}
                onValueChange={(value) => updateKit(index, { ...kit, name: value })}
              />
              <Input
                label="Logo URL"
                value={kit.iconUrl}
                onValueChange={(value) => updateKit(index, { ...kit, iconUrl: value })}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                Base Colors
              </p>
              <div className="grid gap-3 md:grid-cols-4">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <BrandColorField
                    key={`base-${key}`}
                    label={label}
                    value={kit.colors[key]}
                    onChange={(value) => updateBaseColor(index, key, value)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                  Dark Mode Override
                </p>
                <Switch
                  isSelected={Boolean(kit.colors.dark)}
                  size="sm"
                  onValueChange={(enabled) => setVariantEnabled(index, "dark", enabled)}
                >
                  Enabled
                </Switch>
              </div>
              {kit.colors.dark ? (
                <div className="grid gap-3 md:grid-cols-4">
                  {COLOR_FIELDS.map(({ key, label: colorLabel }) => (
                    <BrandColorField
                      key={`dark-${key}`}
                      label={colorLabel}
                      value={kit.colors.dark?.[key] ?? kit.colors[key]}
                      onChange={(value) => updateVariantColor(index, "dark", key, value)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Base colors are used for light mode. Enable this to add dark-mode values via{" "}
                  <code>prefers-color-scheme</code>.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                color="primary"
                isLoading={isPending}
                startContent={<Save className="h-4 w-4" />}
                type="button"
                onPress={() => onSave(kit)}
              >
                Save Kit
              </Button>
              <Button
                color="danger"
                isDisabled={kits.length <= 1}
                isLoading={isPending}
                startContent={<Trash2 className="h-4 w-4" />}
                type="button"
                variant="flat"
                onPress={() => onDelete(kit)}
              >
                Delete Kit
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
