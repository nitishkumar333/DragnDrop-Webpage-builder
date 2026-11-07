import { v4 } from "uuid";
import type {
  EditorElement,
  ElementContent,
} from "@/providers/editor/editor-provider";
import {
  EditorBtns,
  defaultStyles,
  defaultStylesForContainer,
  defaultStylesForText,
} from "./constants";
import { SHADOW_PRESETS } from "./design-tokens";

/**
 * Single source of truth for creating editor elements. Every drop target,
 * the "+" quick-add menu and click-to-add in the sidebar go through
 * `createElement`, so new element types only need to be defined here.
 */

type Styles = React.CSSProperties;

const INK = "#0f172a";
const MUTED = "#64748b";
const ACCENT = "#4f46e5";
const BORDER = "#e2e8f0";

const shadow = (name: string) =>
  SHADOW_PRESETS.find((s) => s.name === name)?.value;

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

const leaf = (
  type: Exclude<EditorBtns, null>,
  name: string,
  styles: Styles,
  content: ElementContent
): EditorElement => ({ id: v4(), type, name, styles, content });

export const makeText = (innerText: string, styles: Styles = {}) =>
  leaf(
    "text",
    "Text",
    {
      color: "#1e293b",
      ...defaultStyles,
      ...defaultStylesForText,
      lineHeight: "1.6",
      ...styles,
    },
    { innerText }
  );

export const makeHeading = (
  innerText: string,
  level: ElementContent["level"] = "h2",
  styles: Styles = {}
) => {
  const size = { h1: "48px", h2: "36px", h3: "22px", h4: "18px" }[level || "h2"];
  return leaf(
    "heading",
    "Heading",
    {
      color: INK,
      ...defaultStyles,
      ...defaultStylesForText,
      fontSize: size,
      fontWeight: "700",
      lineHeight: "1.2",
      letterSpacing: level === "h1" || level === "h2" ? "-0.02em" : "normal",
      ...styles,
    },
    { innerText, level }
  );
};

export const makeButton = (
  innerText: string,
  variant: "primary" | "secondary" | "light" = "primary",
  styles: Styles = {}
) => {
  const variants: Record<string, Styles> = {
    primary: {
      backgroundColor: ACCENT,
      color: "#ffffff",
      boxShadow: shadow("Glow"),
    },
    secondary: {
      backgroundColor: "#ffffff",
      color: INK,
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: BORDER,
    },
    light: { backgroundColor: "#ffffff", color: ACCENT },
  };
  return leaf(
    "button",
    "Button",
    {
      display: "inline-block",
      width: "auto",
      paddingTop: "12px",
      paddingBottom: "12px",
      paddingLeft: "24px",
      paddingRight: "24px",
      borderRadius: "10px",
      fontSize: "15px",
      fontWeight: "600",
      textAlign: "center",
      ...variants[variant],
      ...styles,
    },
    { innerText, href: "#" }
  );
};

export const makeLink = (innerText: string, styles: Styles = {}) =>
  leaf(
    "link",
    "Link",
    {
      color: ACCENT,
      ...defaultStyles,
      ...defaultStylesForText,
      ...styles,
    },
    { innerText, href: "#" }
  );

export const makeImage = (src: string, alt = "", styles: Styles = {}) =>
  leaf(
    "image",
    "Image",
    {
      width: "100%",
      height: "auto",
      objectFit: "cover",
      borderRadius: "12px",
      ...styles,
    },
    { src, alt }
  );

export const makeDivider = (styles: Styles = {}) =>
  leaf(
    "divider",
    "Divider",
    {
      width: "100%",
      height: "1px",
      backgroundColor: BORDER,
      marginTop: "16px",
      marginBottom: "16px",
      ...styles,
    },
    {}
  );

export const makeSpacer = (styles: Styles = {}) =>
  leaf("spacer", "Spacer", { width: "100%", height: "48px", ...styles }, {});

export const makeContainer = (
  children: EditorElement[] = [],
  styles: Styles = {},
  name = "Container",
  type: "container" | "2Col" = "container"
): EditorElement => ({
  id: v4(),
  type,
  name,
  styles: { ...defaultStyles, ...defaultStylesForContainer, ...styles },
  content: children,
});

/** A full-width band with a centred, max-width inner column. */
const makeSection = (
  name: string,
  children: EditorElement[],
  sectionStyles: Styles = {},
  innerStyles: Styles = {}
) =>
  makeContainer(
    [
      makeContainer(children, {
        ...noBox,
        maxWidth: "1100px",
        marginLeft: "auto",
        marginRight: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "48px",
        ...innerStyles,
      }, "Inner"),
    ],
    {
      ...noBox,
      paddingTop: "88px",
      paddingBottom: "88px",
      paddingLeft: "24px",
      paddingRight: "24px",
      ...sectionStyles,
    },
    name
  );

/** Resets padding / margin so layout containers don't add stray spacing. */
const noBox: Styles = {
  paddingTop: "0px",
  paddingBottom: "0px",
  paddingLeft: "0px",
  paddingRight: "0px",
  marginTop: "0px",
  marginBottom: "0px",
  marginLeft: "0px",
  marginRight: "0px",
};

const row = (children: EditorElement[], styles: Styles = {}, name = "Row") =>
  makeContainer(
    children,
    {
      ...noBox,
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: "24px",
      ...styles,
    },
    name
  );

const column = (children: EditorElement[], styles: Styles = {}, name = "Column") =>
  makeContainer(
    children,
    {
      ...noBox,
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      ...styles,
    },
    name
  );

const tight: Styles = {
  marginTop: "0px",
  marginBottom: "0px",
  paddingTop: "0px",
  paddingBottom: "0px",
  paddingLeft: "0px",
  paddingRight: "0px",
};

const sectionHeader = (eyebrow: string, title: string, subtitle: string, dark = false) =>
  column(
    [
      makeText(eyebrow, {
        ...tight,
        color: dark ? "#a5b4fc" : ACCENT,
        fontSize: "13px",
        fontWeight: "700",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textAlign: "center",
      }),
      makeHeading(title, "h2", {
        ...tight,
        textAlign: "center",
        fontSize: "40px",
        fontWeight: "800",
        color: dark ? "#f8fafc" : INK,
      }),
      makeText(subtitle, {
        ...tight,
        textAlign: "center",
        fontSize: "18px",
        color: dark ? "#94a3b8" : MUTED,
        maxWidth: "620px",
        marginLeft: "auto",
        marginRight: "auto",
      }),
    ],
    { alignItems: "center", textAlign: "center" },
    "Header"
  );

const placeholder = (w: number, h: number, bg: string, fg: string, text: string) =>
  `https://placehold.co/${w}x${h}/${bg}/${fg}?text=${encodeURIComponent(text).replace(/%20/g, "+")}`;

// ---------------------------------------------------------------------------
// Blocks (pre-designed sections)
// ---------------------------------------------------------------------------

const navbarBlock = () =>
  makeContainer(
    [
      makeText("◆ Brand", {
        ...tight,
        width: "auto",
        fontSize: "22px",
        fontWeight: "800",
        color: INK,
        letterSpacing: "-0.02em",
      }),
      row(
        [
          ...["Home", "Features", "Pricing", "Contact"].map((label) =>
            makeLink(label, {
              ...tight,
              width: "auto",
              color: "#475569",
              fontSize: "15px",
              fontWeight: "500",
            })
          ),
          makeButton("Get started", "primary", {
            paddingTop: "10px",
            paddingBottom: "10px",
            paddingLeft: "18px",
            paddingRight: "18px",
            fontSize: "14px",
          }),
        ],
        { width: "auto", alignItems: "center", gap: "28px" },
        "Menu"
      ),
    ],
    {
      ...noBox,
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: "16px",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: "18px",
      paddingBottom: "18px",
      paddingLeft: "40px",
      paddingRight: "40px",
      backgroundColor: "#ffffff",
      borderBottomWidth: "1px",
      borderBottomStyle: "solid",
      borderBottomColor: "#eef0f4",
    },
    "Navbar"
  );

const heroBlock = () =>
  makeContainer(
    [
      column(
        [
          makeText("✨ New — launch your site in minutes", {
            ...tight,
            width: "auto",
            display: "inline-block",
            paddingTop: "6px",
            paddingBottom: "6px",
            paddingLeft: "14px",
            paddingRight: "14px",
            borderRadius: "999px",
            backgroundColor: "#ffffff",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "#e0e7ff",
            color: ACCENT,
            fontSize: "13px",
            fontWeight: "600",
          }),
          makeHeading("Build something people love", "h1", {
            ...tight,
            textAlign: "center",
            fontSize: "60px",
            fontWeight: "800",
            lineHeight: "1.05",
          }),
          makeText(
            "A beautiful, fast website without writing a line of code. Drag, drop, tweak the details and publish when you're ready.",
            {
              ...tight,
              textAlign: "center",
              fontSize: "19px",
              color: "#475569",
              maxWidth: "620px",
            }
          ),
          row(
            [
              makeButton("Start for free", "primary"),
              makeButton("See how it works", "secondary"),
            ],
            { width: "auto", justifyContent: "center", gap: "12px", marginTop: "12px" },
            "Actions"
          ),
          makeImage(
            placeholder(1200, 640, "e0e7ff", "4f46e5", "Your product screenshot"),
            "Product screenshot",
            {
              marginTop: "40px",
              borderRadius: "20px",
              boxShadow: shadow("XL"),
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "#e0e7ff",
            }
          ),
        ],
        {
          maxWidth: "980px",
          marginLeft: "auto",
          marginRight: "auto",
          alignItems: "center",
          textAlign: "center",
          gap: "20px",
        },
        "Inner"
      ),
    ],
    {
      ...noBox,
      paddingTop: "96px",
      paddingBottom: "96px",
      paddingLeft: "24px",
      paddingRight: "24px",
      backgroundImage: "linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%)",
    },
    "Hero"
  );

const featureCard = (icon: string, title: string, body: string) =>
  column(
    [
      makeText(icon, {
        ...tight,
        width: "48px",
        height: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontSize: "22px",
        borderRadius: "12px",
        backgroundColor: "#eef2ff",
      }),
      makeHeading(title, "h3", { ...tight, marginTop: "8px" }),
      makeText(body, { ...tight, fontSize: "15px", color: MUTED }),
    ],
    {
      flex: "1 1 260px",
      width: "auto",
      paddingTop: "28px",
      paddingBottom: "28px",
      paddingLeft: "28px",
      paddingRight: "28px",
      borderRadius: "16px",
      backgroundColor: "#ffffff",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "#eef0f4",
      boxShadow: shadow("S"),
    },
    "Card"
  );

const featuresBlock = () =>
  makeSection(
    "Features",
    [
      sectionHeader(
        "Features",
        "Everything you need to ship",
        "Thoughtful building blocks that look great out of the box and bend to your brand."
      ),
      row([
        featureCard("⚡", "Lightning fast", "Pages load instantly with optimised, lightweight markup."),
        featureCard("🎨", "Fully customisable", "Fonts, colors, gradients and shadows — every detail is yours."),
        featureCard("📱", "Responsive", "Layouts wrap gracefully from widescreen down to mobile."),
      ]),
    ],
    { backgroundColor: "#ffffff" }
  );

const testimonialBlock = () =>
  makeSection(
    "Testimonial",
    [
      makeText("★★★★★", {
        ...tight,
        textAlign: "center",
        color: "#fbbf24",
        fontSize: "22px",
        letterSpacing: "0.2em",
      }),
      makeText(
        "“We rebuilt our whole marketing site in an afternoon. It looks better than the one our agency spent three months on.”",
        {
          ...tight,
          textAlign: "center",
          fontSize: "28px",
          lineHeight: "1.45",
          fontWeight: "500",
          color: "#f8fafc",
        }
      ),
      row(
        [
          makeImage(placeholder(112, 112, "6366f1", "ffffff", "JD"), "Avatar", {
            width: "56px",
            height: "56px",
            borderRadius: "999px",
          }),
          column(
            [
              makeText("Jamie Doe", { ...tight, width: "auto", color: "#f8fafc", fontWeight: "600" }),
              makeText("Founder, Acme Inc.", { ...tight, width: "auto", color: "#94a3b8", fontSize: "14px" }),
            ],
            { width: "auto", gap: "2px" },
            "Author"
          ),
        ],
        { width: "auto", justifyContent: "center", alignItems: "center", gap: "14px" },
        "Author row"
      ),
    ],
    { backgroundColor: INK },
    { maxWidth: "780px", gap: "28px", alignItems: "center" }
  );

const pricingCard = (
  plan: string,
  price: string,
  blurb: string,
  features: string[],
  highlighted = false
) => {
  const fg = highlighted ? "#ffffff" : INK;
  const sub = highlighted ? "#c7d2fe" : MUTED;
  return column(
    [
      makeText(plan, { ...tight, color: highlighted ? "#c7d2fe" : ACCENT, fontWeight: "700", fontSize: "14px", letterSpacing: "0.08em", textTransform: "uppercase" }),
      makeHeading(price, "h3", { ...tight, fontSize: "44px", fontWeight: "800", color: fg }),
      makeText(blurb, { ...tight, color: sub, fontSize: "15px" }),
      makeDivider({ backgroundColor: highlighted ? "rgba(255,255,255,0.2)" : "#eef0f4", marginTop: "8px", marginBottom: "8px" }),
      ...features.map((f) => makeText(`✓  ${f}`, { ...tight, color: fg, fontSize: "15px" })),
      makeButton("Get started", highlighted ? "light" : "primary", {
        display: "block",
        width: "100%",
        marginTop: "16px",
        boxShadow: "none",
      }),
    ],
    {
      flex: "1 1 280px",
      width: "auto",
      gap: "10px",
      paddingTop: "32px",
      paddingBottom: "32px",
      paddingLeft: "32px",
      paddingRight: "32px",
      borderRadius: "20px",
      backgroundColor: highlighted ? ACCENT : "#ffffff",
      borderWidth: highlighted ? "0px" : "1px",
      borderStyle: "solid",
      borderColor: "#e2e8f0",
      boxShadow: highlighted ? shadow("XL") : shadow("S"),
    },
    `${plan} plan`
  );
};

const pricingBlock = () =>
  makeSection(
    "Pricing",
    [
      sectionHeader("Pricing", "Simple, honest pricing", "Start free, upgrade when you grow. No hidden fees."),
      row(
        [
          pricingCard("Starter", "$0", "For side projects and experiments.", ["1 website", "Basic components", "Community support"]),
          pricingCard("Pro", "$19", "For creators who want to stand out.", ["Unlimited websites", "All blocks & fonts", "Priority support"], true),
          pricingCard("Team", "$49", "For teams shipping together.", ["Everything in Pro", "5 team seats", "Custom domains"]),
        ],
        { alignItems: "stretch" }
      ),
    ],
    { backgroundColor: "#f8fafc" }
  );

const ctaBlock = () =>
  makeContainer(
    [
      column(
        [
          makeHeading("Ready to build something beautiful?", "h2", {
            ...tight,
            textAlign: "center",
            color: "#ffffff",
            fontSize: "40px",
            fontWeight: "800",
          }),
          makeText("Join thousands of makers launching their ideas today.", {
            ...tight,
            textAlign: "center",
            color: "#e0e7ff",
            fontSize: "18px",
          }),
          makeButton("Get started — it's free", "light", { marginTop: "12px" }),
        ],
        {
          maxWidth: "1100px",
          marginLeft: "auto",
          marginRight: "auto",
          alignItems: "center",
          textAlign: "center",
          gap: "16px",
          paddingTop: "64px",
          paddingBottom: "64px",
          paddingLeft: "32px",
          paddingRight: "32px",
          borderRadius: "24px",
          backgroundImage: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          boxShadow: shadow("XL"),
        },
        "Card"
      ),
    ],
    { ...noBox, paddingTop: "48px", paddingBottom: "48px", paddingLeft: "24px", paddingRight: "24px" },
    "Call to action"
  );

const footerColumn = (title: string, links: string[]) =>
  column(
    [
      makeText(title, { ...tight, color: "#f8fafc", fontWeight: "600", fontSize: "14px" }),
      ...links.map((l) => makeLink(l, { ...tight, color: "#94a3b8", fontSize: "14px" })),
    ],
    { flex: "0 1 160px", width: "auto", gap: "10px" },
    title
  );

const footerBlock = () =>
  makeContainer(
    [
      column(
        [
          row(
            [
              column(
                [
                  makeText("◆ Brand", { ...tight, color: "#ffffff", fontSize: "20px", fontWeight: "800" }),
                  makeText("Beautiful websites, built visually.", { ...tight, color: "#94a3b8", fontSize: "14px" }),
                ],
                { flex: "1 1 260px", width: "auto", gap: "8px" },
                "About"
              ),
              footerColumn("Product", ["Features", "Pricing", "Changelog"]),
              footerColumn("Company", ["About", "Blog", "Careers"]),
            ],
            { gap: "40px", justifyContent: "space-between" }
          ),
          makeDivider({ backgroundColor: "#1e293b", marginTop: "8px", marginBottom: "8px" }),
          makeText(`© ${new Date().getFullYear()} Brand. All rights reserved.`, {
            ...tight,
            color: MUTED,
            fontSize: "13px",
            textAlign: "center",
          }),
        ],
        { maxWidth: "1100px", marginLeft: "auto", marginRight: "auto", gap: "28px" },
        "Inner"
      ),
    ],
    {
      ...noBox,
      paddingTop: "56px",
      paddingBottom: "32px",
      paddingLeft: "24px",
      paddingRight: "24px",
      backgroundColor: INK,
    },
    "Footer"
  );

const galleryBlock = () =>
  makeSection(
    "Gallery",
    [
      sectionHeader("Gallery", "Our recent work", "A few projects we're proud of."),
      row(
        ["c7d2fe/3730a3", "fbcfe8/9d174d", "bbf7d0/166534", "fde68a/92400e", "bae6fd/075985", "e9d5ff/6b21a8"].map(
          (colors, i) =>
            makeImage(
              placeholder(600, 440, colors.split("/")[0], colors.split("/")[1], `Project ${i + 1}`),
              `Project ${i + 1}`,
              { flex: "1 1 280px", width: "auto", height: "220px", borderRadius: "16px" }
            )
        ),
        { gap: "16px" }
      ),
    ],
    { backgroundColor: "#ffffff" }
  );

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createElement(kind: string): EditorElement | null {
  switch (kind) {
    case "text":
      return makeText("Write something meaningful here.");
    case "heading":
      return makeHeading("A bold headline", "h2");
    case "button":
      return makeButton("Click me");
    case "link":
      return makeLink("Link text");
    case "image":
      return makeImage(placeholder(800, 450, "e2e8f0", "64748b", "Image"), "Image");
    case "divider":
      return makeDivider();
    case "spacer":
      return makeSpacer();
    case "video":
      return leaf(
        "video",
        "Video",
        { width: "100%", borderRadius: "12px" },
        { src: "https://www.youtube.com/embed/9Je_iSH_fEU" }
      );
    case "contactForm":
      return leaf("contactForm", "Contact Form", {}, {});
    case "container":
      return makeContainer();
    case "2Col":
      return makeContainer(
        [
          makeContainer([], { width: "100%", marginTop: "0px", marginBottom: "0px" }),
          makeContainer([], { width: "100%", marginTop: "0px", marginBottom: "0px" }),
        ],
        { display: "flex", gap: "16px" },
        "Two Columns",
        "2Col"
      );
    case "navbar":
      return navbarBlock();
    case "hero":
      return heroBlock();
    case "features":
      return featuresBlock();
    case "testimonial":
      return testimonialBlock();
    case "pricing":
      return pricingBlock();
    case "cta":
      return ctaBlock();
    case "footer":
      return footerBlock();
    case "grid":
      return galleryBlock();
    default:
      return null;
  }
}

/** Deep-clone an element, giving it and all descendants fresh ids. */
export function cloneWithNewIds(element: EditorElement): EditorElement {
  return {
    ...element,
    id: v4(),
    styles: { ...element.styles },
    content: Array.isArray(element.content)
      ? element.content.map(cloneWithNewIds)
      : { ...element.content },
  };
}
