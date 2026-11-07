"use client";
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowRight,
  Italic,
  MousePointerClick,
  Underline,
} from "lucide-react";
import { useEditor } from "@/providers/editor/editor-provider";
import { cn } from "@/lib/utils";
import {
  FONT_OPTIONS,
  GRADIENT_PRESETS,
  SHADOW_PRESETS,
} from "@/lib/design-tokens";
import { toYoutubeEmbed } from "@/lib/media-utils";
import {
  BoxField,
  ColorField,
  Field,
  SegmentedField,
  SelectField,
  SliderField,
  TextField,
  toNumber,
} from "./settings/controls";

const TEXT_PRESETS: { name: string; styles: React.CSSProperties }[] = [
  { name: "Display", styles: { fontSize: "60px", fontWeight: "800", lineHeight: "1.05", letterSpacing: "-0.03em", textTransform: "none" } },
  { name: "H1", styles: { fontSize: "44px", fontWeight: "800", lineHeight: "1.1", letterSpacing: "-0.02em", textTransform: "none" } },
  { name: "H2", styles: { fontSize: "34px", fontWeight: "700", lineHeight: "1.2", letterSpacing: "-0.02em", textTransform: "none" } },
  { name: "H3", styles: { fontSize: "22px", fontWeight: "700", lineHeight: "1.3", letterSpacing: "normal", textTransform: "none" } },
  { name: "Body", styles: { fontSize: "16px", fontWeight: "400", lineHeight: "1.6", letterSpacing: "normal", textTransform: "none" } },
  { name: "Small", styles: { fontSize: "14px", fontWeight: "400", lineHeight: "1.5", letterSpacing: "normal", textTransform: "none" } },
  { name: "Eyebrow", styles: { fontSize: "12px", fontWeight: "700", lineHeight: "1.4", letterSpacing: "0.12em", textTransform: "uppercase" } },
];

const BUTTON_PRESETS: { name: string; styles: React.CSSProperties }[] = [
  { name: "Solid", styles: { backgroundColor: "#4f46e5", backgroundImage: "", color: "#ffffff", borderWidth: "0px", borderRadius: "10px", boxShadow: SHADOW_PRESETS[5].value } },
  { name: "Outline", styles: { backgroundColor: "transparent", backgroundImage: "", color: "#4f46e5", borderWidth: "2px", borderStyle: "solid", borderColor: "#4f46e5", borderRadius: "10px", boxShadow: "none" } },
  { name: "Soft", styles: { backgroundColor: "#eef2ff", backgroundImage: "", color: "#4338ca", borderWidth: "0px", borderRadius: "10px", boxShadow: "none" } },
  { name: "Pill", styles: { backgroundColor: "#0f172a", backgroundImage: "", color: "#ffffff", borderWidth: "0px", borderRadius: "999px", boxShadow: "none" } },
  { name: "Gradient", styles: { backgroundColor: "", backgroundImage: GRADIENT_PRESETS[0].value, color: "#ffffff", borderWidth: "0px", borderRadius: "12px", boxShadow: SHADOW_PRESETS[5].value } },
];

const HEADING_SIZES = { h1: "48px", h2: "36px", h3: "22px", h4: "18px" } as const;

const PresetButtons = ({
  presets,
  onPick,
}: {
  presets: { name: string; styles: React.CSSProperties }[];
  onPick: (styles: React.CSSProperties) => void;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {presets.map((p) => (
      <button
        key={p.name}
        type="button"
        onClick={() => onPick(p.styles)}
        className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
      >
        {p.name}
      </button>
    ))}
  </div>
);

const SettingsTab = () => {
  const { state, dispatch } = useEditor();
  const el = state.editor.selectedElement;
  const s = el.styles;

  if (!el.id) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
        <MousePointerClick className="text-muted-foreground/60" size={36} />
        Select an element on the canvas to edit its content and style.
      </div>
    );
  }

  const content = Array.isArray(el.content) ? {} : el.content;
  const type = el.type;
  const isBody = type === "__body";
  const isText = type === "text" || type === "heading";
  const isLinkLike = type === "link" || type === "button";
  const isContainer =
    type === "container" || type === "2Col" || type === "section" || isBody;
  const isMedia = type === "image" || type === "video";
  const showTypography = !isMedia && type !== "divider" && type !== "spacer";

  const setStyles = (styles: React.CSSProperties, coalesce = false) =>
    dispatch({
      type: "UPDATE_ELEMENT_STYLES",
      payload: { elementId: el.id, styles, coalesce },
    });
  const setStyle = (prop: keyof React.CSSProperties, value: unknown, coalesce = false) =>
    setStyles({ [prop]: value } as React.CSSProperties, coalesce);
  const setContent = (patch: Record<string, string>, coalesce = false) =>
    dispatch({
      type: "UPDATE_ELEMENT_CONTENT",
      payload: { elementId: el.id, content: patch, coalesce },
    });

  const bgImage = String(s.backgroundImage ?? "");
  const bgUrl = bgImage.startsWith("url(")
    ? bgImage.replace(/^url\(["']?/, "").replace(/["']?\)$/, "")
    : "";
  const display = String(s.display ?? "block");
  const isFlex = display === "flex";
  const isGrid = display === "grid";
  const gridColumns = Number(
    String(s.gridTemplateColumns ?? "").match(/repeat\((\d+)/)?.[1] ?? 2
  );

  const sections = ["content", "typography", "background", "layout", "spacing", "border"];

  return (
    <div className="flex flex-col">
      {/* Element header */}
      <div className="flex items-center gap-2 px-6 pb-4">
        <Input
          className="h-8 text-sm font-medium"
          value={el.name}
          disabled={isBody}
          onChange={(e) =>
            dispatch({
              type: "RENAME_ELEMENT",
              payload: { elementId: el.id, name: e.target.value },
            })
          }
        />
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {isBody ? "page" : type}
        </span>
      </div>

      <Accordion type="multiple" className="w-full" defaultValue={sections} key={el.id}>
        {/* ------------------------------------------------------- Content */}
        {(isText || isLinkLike || isMedia) && (
          <AccordionItem value="content" className="border-t px-6">
            <AccordionTrigger className="!no-underline">Content</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              {type === "heading" && (
                <SegmentedField
                  label="Heading level"
                  value={content.level ?? "h2"}
                  options={(["h1", "h2", "h3", "h4"] as const).map((l) => ({
                    value: l,
                    title: l.toUpperCase(),
                    label: l.toUpperCase(),
                  }))}
                  onChange={(level) => {
                    setContent({ level });
                    setStyle("fontSize", HEADING_SIZES[level as keyof typeof HEADING_SIZES]);
                  }}
                />
              )}
              {(isText || isLinkLike) && (
                <Field label="Text">
                  <Textarea
                    className="min-h-[64px] text-xs"
                    value={content.innerText ?? ""}
                    onChange={(e) => setContent({ innerText: e.target.value }, true)}
                  />
                </Field>
              )}
              {isLinkLike && (
                <>
                  <TextField
                    label="Link URL"
                    placeholder="https://example.com or #section"
                    value={content.href}
                    onChange={(href) => setContent({ href }, true)}
                  />
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-normal text-muted-foreground">
                      Open in new tab
                    </Label>
                    <Switch
                      checked={content.target === "_blank"}
                      onCheckedChange={(v) => setContent({ target: v ? "_blank" : "_self" })}
                    />
                  </div>
                </>
              )}
              {type === "image" && (
                <>
                  <TextField
                    label="Image URL"
                    placeholder="https://…"
                    value={content.src}
                    onChange={(src) => setContent({ src }, true)}
                  />
                  <TextField
                    label="Alt text"
                    placeholder="Describe the image"
                    value={content.alt}
                    onChange={(alt) => setContent({ alt }, true)}
                  />
                  <SegmentedField
                    label="Fit"
                    value={String(s.objectFit ?? "cover")}
                    options={[
                      { value: "cover", title: "Fill & crop", label: "Cover" },
                      { value: "contain", title: "Fit inside", label: "Contain" },
                    ]}
                    onChange={(v) => setStyle("objectFit", v)}
                  />
                </>
              )}
              {type === "video" && (
                <TextField
                  label="YouTube URL"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={content.src}
                  onChange={(src) => setContent({ src: toYoutubeEmbed(src) }, true)}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ---------------------------------------------------- Typography */}
        {showTypography && (
          <AccordionItem value="typography" className="px-6">
            <AccordionTrigger className="!no-underline">
              {isBody ? "Page typography" : "Typography"}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              {isText && (
                <Field label="Text style">
                  <PresetButtons presets={TEXT_PRESETS} onPick={(p) => setStyles(p)} />
                </Field>
              )}
              <SelectField
                label="Font"
                value={
                  FONT_OPTIONS.find((f) => f.value === s.fontFamily)?.value ?? "inherit"
                }
                options={[
                  { value: "inherit", label: isBody ? "Default" : "Inherit from parent" },
                  ...FONT_OPTIONS.map((f) => ({
                    value: f.value,
                    label: f.label,
                    style: { fontFamily: f.value },
                  })),
                ]}
                onChange={(v) => setStyle("fontFamily", v === "inherit" ? "" : v)}
              />
              <ColorField
                label="Text color"
                value={s.color as string}
                onChange={(v, c) => setStyle("color", v, c)}
              />
              {!isBody && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Weight"
                      value={String(s.fontWeight ?? "400").replace("normal", "400").replace("bold", "700")}
                      options={[
                        ["300", "Light"],
                        ["400", "Regular"],
                        ["500", "Medium"],
                        ["600", "Semibold"],
                        ["700", "Bold"],
                        ["800", "Extra bold"],
                      ].map(([value, label]) => ({ value, label }))}
                      onChange={(v) => setStyle("fontWeight", v)}
                    />
                    <Field label="Style">
                      <div className="flex h-8 gap-1 rounded-md border p-0.5">
                        <button
                          type="button"
                          title="Italic"
                          onClick={() => setStyle("fontStyle", s.fontStyle === "italic" ? "" : "italic")}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded text-muted-foreground",
                            s.fontStyle === "italic" && "bg-muted text-foreground"
                          )}
                        >
                          <Italic size={14} />
                        </button>
                        <button
                          type="button"
                          title="Underline"
                          onClick={() =>
                            setStyle("textDecoration", s.textDecoration === "underline" ? "" : "underline")
                          }
                          className={cn(
                            "flex flex-1 items-center justify-center rounded text-muted-foreground",
                            s.textDecoration === "underline" && "bg-muted text-foreground"
                          )}
                        >
                          <Underline size={14} />
                        </button>
                      </div>
                    </Field>
                  </div>
                  <SliderField
                    label="Size"
                    unit="px"
                    min={8}
                    max={120}
                    value={toNumber(s.fontSize, 16)}
                    onChange={(v) => setStyle("fontSize", `${v}px`, true)}
                  />
                  <SliderField
                    label="Line height"
                    min={0.8}
                    max={2.4}
                    step={0.05}
                    value={toNumber(s.lineHeight, 1.5)}
                    onChange={(v) => setStyle("lineHeight", String(Number(v.toFixed(2))), true)}
                  />
                  <SliderField
                    label="Letter spacing"
                    unit="em"
                    min={-0.1}
                    max={0.3}
                    step={0.01}
                    value={toNumber(s.letterSpacing, 0)}
                    onChange={(v) => setStyle("letterSpacing", `${Number(v.toFixed(2))}em`, true)}
                  />
                </>
              )}
              <SegmentedField
                label="Align"
                value={String(s.textAlign ?? "left")}
                options={[
                  { value: "left", title: "Left", icon: <AlignLeft size={15} /> },
                  { value: "center", title: "Center", icon: <AlignCenter size={15} /> },
                  { value: "right", title: "Right", icon: <AlignRight size={15} /> },
                  { value: "justify", title: "Justify", icon: <AlignJustify size={15} /> },
                ]}
                onChange={(v) => setStyle("textAlign", v)}
              />
              {!isBody && !isContainer && (
                <SegmentedField
                  label="Case"
                  value={String(s.textTransform ?? "none")}
                  options={[
                    { value: "none", title: "As typed", label: "—" },
                    { value: "uppercase", title: "Uppercase", label: "AA" },
                    { value: "capitalize", title: "Capitalize", label: "Aa" },
                    { value: "lowercase", title: "Lowercase", label: "aa" },
                  ]}
                  onChange={(v) => setStyle("textTransform", v)}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ---------------------------------------------------- Background */}
        {type !== "video" && (
          <AccordionItem value="background" className="px-6">
            <AccordionTrigger className="!no-underline">
              {type === "divider" ? "Color" : "Background"}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              {type === "button" && (
                <Field label="Button style">
                  <PresetButtons presets={BUTTON_PRESETS} onPick={(p) => setStyles(p)} />
                </Field>
              )}
              <ColorField
                label={type === "divider" ? "Line color" : "Background color"}
                value={s.backgroundColor as string}
                onChange={(v, c) => setStyle("backgroundColor", v, c)}
              />
              {type !== "divider" && type !== "image" && (
                <>
                  <Field label="Gradient">
                    <div className="grid grid-cols-5 gap-1.5">
                      <button
                        type="button"
                        title="No gradient"
                        onClick={() => !bgUrl && setStyle("backgroundImage", "")}
                        className="h-8 rounded-md border text-[10px] text-muted-foreground"
                      >
                        None
                      </button>
                      {GRADIENT_PRESETS.map((g) => (
                        <button
                          key={g.name}
                          type="button"
                          title={g.name}
                          onClick={() => setStyle("backgroundImage", g.value)}
                          className={cn(
                            "h-8 rounded-md border transition hover:scale-105",
                            bgImage === g.value && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                          )}
                          style={{ backgroundImage: g.value }}
                        />
                      ))}
                    </div>
                  </Field>
                  <TextField
                    label="Background image URL"
                    placeholder="https://…"
                    value={bgUrl}
                    onChange={(url) => setStyle("backgroundImage", url ? `url(${url})` : "", true)}
                  />
                  {bgUrl && (
                    <SegmentedField
                      label="Image size"
                      value={String(s.backgroundSize ?? "auto")}
                      options={[
                        { value: "cover", title: "Cover", label: "Cover" },
                        { value: "contain", title: "Contain", label: "Contain" },
                        { value: "auto", title: "Original", label: "Auto" },
                      ]}
                      onChange={(v) => setStyle("backgroundSize", v)}
                    />
                  )}
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* -------------------------------------------------------- Layout */}
        {isContainer && !isBody && (
          <AccordionItem value="layout" className="px-6">
            <AccordionTrigger className="!no-underline">Layout</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <SegmentedField
                label="Display"
                value={display}
                options={[
                  { value: "block", title: "Stack", label: "Block" },
                  { value: "flex", title: "Flexbox", label: "Flex" },
                  { value: "grid", title: "Grid", label: "Grid" },
                ]}
                onChange={(v) =>
                  setStyles({
                    display: v,
                    gridTemplateColumns:
                      v === "grid" ? s.gridTemplateColumns || "repeat(2, minmax(0, 1fr))" : s.gridTemplateColumns,
                  })
                }
              />
              {isFlex && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SegmentedField
                      label="Direction"
                      value={String(s.flexDirection ?? "row")}
                      options={[
                        { value: "row", title: "Horizontal", icon: <ArrowRight size={15} /> },
                        { value: "column", title: "Vertical", icon: <ArrowDown size={15} /> },
                      ]}
                      onChange={(v) => setStyle("flexDirection", v)}
                    />
                    <Field label="Wrap">
                      <div className="flex h-8 items-center">
                        <Switch
                          checked={s.flexWrap === "wrap"}
                          onCheckedChange={(v) => setStyle("flexWrap", v ? "wrap" : "nowrap")}
                        />
                      </div>
                    </Field>
                  </div>
                  <SegmentedField
                    label="Justify"
                    value={String(s.justifyContent ?? "start")}
                    options={[
                      { value: "start", title: "Start", icon: <AlignHorizontalJustifyStart size={15} /> },
                      { value: "center", title: "Center", icon: <AlignHorizontalJustifyCenter size={15} /> },
                      { value: "end", title: "End", icon: <AlignHorizontalJustifyEnd size={15} /> },
                      { value: "space-between", title: "Space between", icon: <AlignHorizontalSpaceBetween size={15} /> },
                    ]}
                    onChange={(v) => setStyle("justifyContent", v)}
                  />
                  <SegmentedField
                    label="Align"
                    value={String(s.alignItems ?? "stretch")}
                    options={[
                      { value: "stretch", title: "Stretch", icon: <AlignVerticalSpaceAround size={15} /> },
                      { value: "start", title: "Start", icon: <AlignVerticalJustifyStart size={15} /> },
                      { value: "center", title: "Center", icon: <AlignVerticalJustifyCenter size={15} /> },
                      { value: "end", title: "End", icon: <AlignVerticalJustifyEnd size={15} /> },
                    ]}
                    onChange={(v) => setStyle("alignItems", v)}
                  />
                </>
              )}
              {isGrid && (
                <SliderField
                  label="Columns"
                  min={1}
                  max={6}
                  value={gridColumns}
                  onChange={(v) => setStyle("gridTemplateColumns", `repeat(${v}, minmax(0, 1fr))`, true)}
                />
              )}
              {(isFlex || isGrid) && (
                <SliderField
                  label="Gap"
                  unit="px"
                  max={96}
                  value={toNumber(s.gap, 0)}
                  onChange={(v) => setStyle("gap", `${v}px`, true)}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ------------------------------------------------ Size & spacing */}
        {!isBody && (
          <AccordionItem value="spacing" className="px-6">
            <AccordionTrigger className="!no-underline">Size & spacing</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Width" units placeholder="auto" value={s.width as string} onChange={(v) => setStyle("width", v, true)} />
                <TextField label="Height" units placeholder="auto" value={s.height as string} onChange={(v) => setStyle("height", v, true)} />
                <TextField label="Max width" units placeholder="none" value={s.maxWidth as string} onChange={(v) => setStyle("maxWidth", v, true)} />
                <TextField label="Min height" units placeholder="0" value={s.minHeight as string} onChange={(v) => setStyle("minHeight", v, true)} />
              </div>
              <BoxField label="Margin" prefix="margin" styles={s} onChange={(p) => setStyles(p, true)} />
              <BoxField label="Padding" prefix="padding" styles={s} onChange={(p) => setStyles(p, true)} />
              <button
                type="button"
                className="self-start text-xs text-primary hover:underline"
                onClick={() => setStyles({ marginLeft: "auto", marginRight: "auto" })}
              >
                Center horizontally
              </button>
              <TextField
                label="Flex (when inside a row)"
                placeholder="e.g. 1 1 260px"
                value={s.flex as string}
                onChange={(v) => setStyle("flex", v, true)}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ------------------------------------------------ Border & effects */}
        {!isBody && (
          <AccordionItem value="border" className="px-6">
            <AccordionTrigger className="!no-underline">Border & effects</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <SliderField
                label="Corner radius"
                unit="px"
                max={64}
                value={Math.min(toNumber(s.borderRadius, 0), 64)}
                onChange={(v) => setStyle("borderRadius", `${v}px`, true)}
              />
              <button
                type="button"
                className="-mt-2 self-start text-xs text-primary hover:underline"
                onClick={() => setStyle("borderRadius", "999px")}
              >
                Make fully rounded
              </button>
              <div className="grid grid-cols-2 gap-3">
                <SliderField
                  label="Border"
                  unit="px"
                  max={12}
                  value={toNumber(s.borderWidth, 0)}
                  onChange={(v) =>
                    setStyles(
                      { borderWidth: `${v}px`, borderStyle: s.borderStyle || "solid" },
                      true
                    )
                  }
                />
                <SelectField
                  label="Style"
                  value={String(s.borderStyle ?? "solid")}
                  options={["solid", "dashed", "dotted"].map((v) => ({ value: v, label: v }))}
                  onChange={(v) => setStyle("borderStyle", v)}
                />
              </div>
              <ColorField
                label="Border color"
                value={s.borderColor as string}
                onChange={(v, c) => setStyle("borderColor", v, c)}
              />
              <Field label="Shadow">
                <div className="grid grid-cols-6 gap-1.5">
                  {SHADOW_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      title={`${p.name} shadow`}
                      onClick={() => setStyle("boxShadow", p.value === "none" ? "" : p.value)}
                      className={cn(
                        "h-8 rounded-md border bg-white text-[10px] text-slate-500",
                        (s.boxShadow ?? "none") === p.value && "ring-2 ring-primary"
                      )}
                      style={{ boxShadow: p.value }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </Field>
              <SliderField
                label="Opacity"
                unit="%"
                value={toNumber(s.opacity, 100)}
                onChange={(v) => setStyle("opacity", `${v}%`, true)}
              />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};

export default SettingsTab;
