"use client";
import clsx from "clsx";
import { ArrowUpRight, ExternalLink, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

export type PageSummary = { id: string; name?: string; updatedAt?: string };

/** The width pages are laid out at inside a preview, before scaling down. */
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 800;
const PREVIEW_TIMEOUT_MS = 10_000;

const TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const editedAgo = (iso?: string) => {
  const time = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(time)) return null;
  const seconds = (time - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of TIME_UNITS) {
    if (Math.abs(seconds) >= size) return `Edited ${format.format(Math.round(seconds / size), unit)}`;
  }
  return "Edited just now";
};

/**
 * The saved page itself, laid out at desktop width and scaled to fit the card.
 * The site route marks its canvas with `data-live` once the page has loaded,
 * which is what tells a page with no content from one still starting up.
 */
const PagePreview = ({ page }: { page: PageSummary }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "blank">("loading");

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / PREVIEW_WIDTH)
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!frameLoaded) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const canvas = frame.current?.contentDocument?.querySelector(
        "[data-canvas-root][data-live]"
      );
      if (canvas) {
        clearInterval(timer);
        setStatus(canvas.querySelector("[data-element-id]") ? "ready" : "blank");
      } else if (Date.now() - started > PREVIEW_TIMEOUT_MS) {
        clearInterval(timer);
        setStatus("blank");
      }
    }, 100);
    return () => clearInterval(timer);
  }, [frameLoaded]);

  // The opacity makes the browser flatten the preview before the card's rounded
  // corner clips it. Clipped layer by layer, the white behind a dark page shows
  // through the curve's soft edge pixels as a pale line.
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden bg-muted/40 opacity-[0.999]">
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {status === "blank" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <LayoutTemplate className="h-7 w-7 opacity-60" />
          <span className="text-xs">Nothing here yet</span>
        </div>
      )}
      {status !== "blank" && (
        <iframe
          ref={frame}
          src={`/site/${encodeURIComponent(page.id)}`}
          title=""
          aria-hidden
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-same-origin allow-scripts"
          onLoad={() => setFrameLoaded(true)}
          className={clsx(
            "pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500",
            status === "ready" ? "opacity-100" : "opacity-0"
          )}
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  );
};

const PageCard = ({ page }: { page: PageSummary }) => {
  const name = page.name || "Untitled page";
  const edited = editedAgo(page.updatedAt);

  return (
    <article className="group relative flex flex-col rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10">
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-[15px] border-b">
        <PagePreview page={page} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-900 shadow-lg">
            Open editor
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="min-w-0 px-4 py-3">
        {/* Stretched over the card, so the whole card opens the editor. */}
        <Link
          href={`/main/${page.id}`}
          title={name}
          className="block truncate font-medium outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        >
          {name}
        </Link>
        <p className="mt-0.5 h-4 truncate text-xs text-muted-foreground">{edited}</p>
      </div>

      <a
        href={`/site/${page.id}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View site"
        aria-label={`View ${name} site`}
        className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-lg border bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </article>
  );
};

export const PageCardSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border bg-card">
    <div className="aspect-[16/10] animate-pulse border-b bg-muted" />
    <div className="space-y-2 px-4 py-3">
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
    </div>
  </div>
);

export default PageCard;
