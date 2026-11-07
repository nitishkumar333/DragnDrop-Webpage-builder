"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { COLOR_SWATCHES } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Sketch } from "@uiw/react-color";
import React from "react";

/** Small, reusable inputs for the style panel. */

export const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const n = parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
};

/** Bare numbers become px; anything else (%, rem, auto, calc…) is kept. */
export const withUnit = (value: string) =>
  /^-?\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;

export const Field = ({
  label,
  children,
  className,
  aside,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    <div className="flex items-center justify-between">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {aside}
    </div>
    {children}
  </div>
);

export const TextField = ({
  label,
  value,
  placeholder,
  onChange,
  units = false,
}: {
  label: string;
  value?: string | number;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Append px to bare numbers. */
  units?: boolean;
}) => (
  <Field label={label}>
    <Input
      className="h-8 text-xs"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        if (units && e.target.value) {
          const normalized = withUnit(e.target.value);
          if (normalized !== e.target.value) onChange(normalized);
        }
      }}
    />
  </Field>
);

export const SliderField = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) => (
  <Field
    label={label}
    aside={
      <span className="text-xs tabular-nums text-muted-foreground">
        {Number(value.toFixed(2))}
        {unit}
      </span>
    }
  >
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
      className="py-1"
    />
  </Field>
);

export type SegmentOption = {
  value: string;
  title: string;
  icon?: React.ReactNode;
  label?: string;
};

export const SegmentedField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: SegmentOption[];
  onChange: (value: string) => void;
}) => (
  <Field label={label}>
    <div className="flex gap-1 rounded-md border p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex h-7 flex-1 items-center justify-center rounded text-xs text-muted-foreground transition hover:text-foreground",
            value === opt.value && "bg-muted text-foreground shadow-sm"
          )}
        >
          {opt.icon ?? opt.label}
        </button>
      ))}
    </div>
  </Field>
);

export const SelectField = ({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; style?: React.CSSProperties }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <Field label={label}>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-[100] max-h-72">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} style={opt.style}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

const isHex = (v?: string) => !!v && /^#([0-9a-f]{3,8})$/i.test(v);

export const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  /** `coalesce` is true while dragging inside the picker. */
  onChange: (value: string, coalesce: boolean) => void;
}) => (
  <Field label={label}>
    <div className="flex h-8 items-center overflow-hidden rounded-md border">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Pick a color"
            className="h-full w-9 shrink-0 border-r bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] bg-[length:10px_10px]"
          >
            <span className="block h-full w-full" style={{ background: value }} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" className="z-[100] w-auto p-0">
          <Sketch
            color={isHex(value) ? value : "#ffffff"}
            presetColors={COLOR_SWATCHES}
            style={{ boxShadow: "none" }}
            onChange={(c) => onChange(c.rgba.a < 1 ? c.hexa : c.hex, true)}
          />
          <button
            type="button"
            className="w-full border-t py-1.5 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => onChange("", false)}
          >
            Clear
          </button>
        </PopoverContent>
      </Popover>
      <input
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-xs outline-none"
        placeholder="none"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value, true)}
      />
    </div>
  </Field>
);

/** Four-sided spacing editor (margin / padding). */
export const BoxField = ({
  label,
  prefix,
  styles,
  onChange,
}: {
  label: string;
  prefix: "margin" | "padding";
  styles: React.CSSProperties;
  onChange: (patch: React.CSSProperties) => void;
}) => {
  const sides = ["Top", "Right", "Bottom", "Left"] as const;
  const get = (side: (typeof sides)[number]) =>
    (styles as Record<string, unknown>)[`${prefix}${side}`] as string | undefined;

  return (
    <Field label={label}>
      <div className="grid grid-cols-4 gap-1.5">
        {sides.map((side) => (
          <div key={side} className="flex flex-col items-center gap-0.5">
            <Input
              className="h-8 px-1 text-center text-xs"
              value={get(side) ?? ""}
              placeholder="0"
              onChange={(e) => onChange({ [`${prefix}${side}`]: e.target.value })}
              onBlur={(e) => {
                if (!e.target.value) return;
                const normalized = withUnit(e.target.value);
                if (normalized !== e.target.value) {
                  onChange({ [`${prefix}${side}`]: normalized });
                }
              }}
            />
            <span className="text-[10px] text-muted-foreground">{side}</span>
          </div>
        ))}
      </div>
    </Field>
  );
};
