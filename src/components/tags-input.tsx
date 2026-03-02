"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

type TagsInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  validateTag?: (value: string) => boolean;
  onInvalidTag?: (value: string) => void;
};

export function TagsInput({
  value,
  onChange,
  placeholder = "Type an email and press Enter",
  validateTag,
  onInvalidTag
}: TagsInputProps) {
  const [input, setInput] = useState("");

  const tags = useMemo(
    () =>
      value
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, arr) => arr.indexOf(item) === index),
    [value]
  );

  const addTag = (raw: string) => {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned)) {
      return;
    }
    if (validateTag && !validateTag(cleaned)) {
      onInvalidTag?.(cleaned);
      return;
    }
    onChange([...tags, cleaned]);
  };

  return (
    <div className="rounded-xl border border-white/15 bg-black/25 p-3">
      <div className="mb-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            className="flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs"
            key={tag}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            type="button"
          >
            <span>{tag}</span>
            <X className="h-3 w-3" />
          </button>
        ))}
      </div>

      <input
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== ",") {
            return;
          }
          event.preventDefault();
          addTag(input);
          setInput("");
        }}
        placeholder={placeholder}
        value={input}
      />
    </div>
  );
}
