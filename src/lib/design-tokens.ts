/** Curated design presets used by the style panel and block templates. */

export type FontOption = {
  label: string;
  /** Google Fonts family name (undefined for system fonts). */
  google?: string;
  value: string;
};

export const FONT_OPTIONS: FontOption[] = [
  { label: "Inter", google: "Inter", value: "'Inter', sans-serif" },
  { label: "Poppins", google: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Manrope", google: "Manrope", value: "'Manrope', sans-serif" },
  { label: "DM Sans", google: "DM Sans", value: "'DM Sans', sans-serif" },
  {
    label: "Space Grotesk",
    google: "Space Grotesk",
    value: "'Space Grotesk', sans-serif",
  },
  { label: "Outfit", google: "Outfit", value: "'Outfit', sans-serif" },
  { label: "Montserrat", google: "Montserrat", value: "'Montserrat', sans-serif" },
  {
    label: "Playfair Display",
    google: "Playfair Display",
    value: "'Playfair Display', serif",
  },
  { label: "Lora", google: "Lora", value: "'Lora', serif" },
  {
    label: "Merriweather",
    google: "Merriweather",
    value: "'Merriweather', serif",
  },
  {
    label: "JetBrains Mono",
    google: "JetBrains Mono",
    value: "'JetBrains Mono', monospace",
  },
  { label: "System UI", value: "system-ui, -apple-system, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
];

/** Returns the Google family name for a stored CSS font-family value. */
export const googleFamilyFor = (fontFamily?: string) => {
  if (!fontFamily) return undefined;
  const first = fontFamily.split(",")[0].replace(/['"]/g, "").trim();
  return FONT_OPTIONS.find((f) => f.google === first)?.google;
};

export const googleFontsHref = (families: string[]) => {
  if (families.length === 0) return null;
  const params = families
    .map(
      (f) =>
        `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800`
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

export const COLOR_SWATCHES = [
  "#0f172a",
  "#334155",
  "#64748b",
  "#cbd5e1",
  "#f1f5f9",
  "#ffffff",
  "#4f46e5",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#f59e0b",
  "#16a34a",
  "#0d9488",
  "#0284c7",
  "#2563eb",
];

export const GRADIENT_PRESETS: { name: string; value: string }[] = [
  { name: "Indigo", value: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" },
  { name: "Sunset", value: "linear-gradient(135deg, #f97316 0%, #db2777 100%)" },
  { name: "Ocean", value: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" },
  { name: "Mint", value: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)" },
  { name: "Peach", value: "linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)" },
  { name: "Lavender", value: "linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%)" },
  { name: "Night", value: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" },
  { name: "Aurora", value: "linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" },
  { name: "Paper", value: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)" },
];

export const SHADOW_PRESETS: { name: string; value: string }[] = [
  { name: "None", value: "none" },
  { name: "S", value: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.1)" },
  { name: "M", value: "0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)" },
  { name: "L", value: "0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08)" },
  { name: "XL", value: "0 25px 50px -12px rgba(15, 23, 42, 0.25)" },
  { name: "Glow", value: "0 10px 40px -10px rgba(79, 70, 229, 0.55)" },
];
