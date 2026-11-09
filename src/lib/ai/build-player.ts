import { flushSync } from "react-dom";
import type { Dispatch } from "react";
import { findElement } from "@/lib/editor-tree";
import type { EditorAction } from "@/providers/editor/editor-actions";
import type { EditorElement } from "@/providers/editor/editor-provider";
import type { EditorOperation } from "./operations";

/**
 * Plays the AI's changes back as if someone were building the page by hand.
 *
 * Every operation still goes into the editor state whole and in order, so undo,
 * save and "Stop" always see a real page. Only the display is staged: a new
 * section is committed with its elements hidden (they keep their final layout,
 * so nothing reflows), then revealed one at a time while a cursor moves between
 * them. Everything per-frame touches the DOM directly and stays out of React.
 */

const HIDDEN_ATTR = "data-build-hidden";
const LOADING_ATTR = "data-build-loading";
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const TRAVEL_MS = 180;
const SHELL_MS = 260;
const BUTTON_MS = 240;
const IMAGE_MS = 520;
const BLOCK_MS = 340;
const DIVIDER_MS = 300;
const GROW_MS = 420;
const EDIT_MS = 320;
const REMOVE_MS = 240;
const FLIP_MS = 320;
const TYPE_MS_PER_CHAR = 28;
const TYPE_MIN_MS = 160;
const TYPE_MAX_MS = 900;

/** With more than this much left to play, speed up in proportion until it has caught up. */
const MAX_BACKLOG_MS = 12_000;
const MIN_SCALE = 0.15;
/** Above this many edits in one batch, sweep through them without moving the page. */
const CROWDED_EDITS = 8;
const USER_SCROLL_PAUSE_MS = 2000;
const VIEW_MARGIN = 96;

type RevealKind = "structure" | "shell" | "text" | "button" | "image" | "block" | "divider";
type RevealStep = {
  element: EditorElement;
  kind: RevealKind;
  /** Time on the element, not counting the cursor's travel to it. */
  ms: number;
  painted: boolean;
};

const hasPaint = (styles: EditorElement["styles"]) =>
  Object.entries(styles).some(([prop, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (prop === "boxShadow") return value !== "none";
    // Not backgroundPosition or backgroundRepeat, which every template sets.
    if (prop === "background" || prop === "backgroundColor" || prop === "backgroundImage") {
      return value !== "transparent" && value !== "none";
    }
    if (/^border(Top|Right|Bottom|Left)?Width$/.test(prop)) return parseFloat(String(value)) > 0;
    return false;
  });

const typingTime = (text: string) =>
  Math.min(TYPE_MAX_MS, Math.max(TYPE_MIN_MS, text.length * TYPE_MS_PER_CHAR));

const textOf = (element: EditorElement) =>
  Array.isArray(element.content) ? "" : element.content.innerText ?? "";

/** Reveal order for an inserted element: parents first, then top to bottom. */
const planReveal = (element: EditorElement, steps: RevealStep[] = []): RevealStep[] => {
  const painted = hasPaint(element.styles);
  const step = (kind: RevealKind, ms: number) => steps.push({ element, kind, ms, painted });

  switch (element.type) {
    case "text":
    case "heading":
    case "link":
      if (textOf(element)) step("text", typingTime(textOf(element)));
      else step("block", BLOCK_MS);
      break;
    case "button":
      step("button", BUTTON_MS);
      break;
    case "image":
      step("image", IMAGE_MS);
      break;
    case "divider":
      step("divider", DIVIDER_MS);
      break;
    case "video":
    case "contactForm":
      step("block", BLOCK_MS);
      break;
    case "spacer":
      step("structure", 0);
      break;
    default:
      // Invisible wrappers appear instantly; the cursor only visits what you can see.
      step(painted ? "shell" : "structure", painted ? SHELL_MS : 0);
  }
  if (Array.isArray(element.content)) {
    element.content.forEach((child) => planReveal(child, steps));
  }
  return steps;
};

const stepCost = (step: RevealStep) => (step.ms > 0 ? step.ms + TRAVEL_MS : 0);

const estimate = (operations: EditorOperation[]) =>
  operations.reduce(
    (total, op) =>
      total +
      (op.op === "insert"
        ? planReveal(op.element).reduce((sum, step) => sum + stepCost(step), 0)
        : TRAVEL_MS + EDIT_MS),
    0
  );

/** One timestamp per character, uneven like real typing and ending at 1. */
const typingTimeline = (chars: string[]) => {
  let total = 0;
  const times = chars.map((char) => {
    let weight = 0.7 + Math.random() * 0.6;
    if (char === " ") weight *= 1.3;
    if (/[.,!?;:]/.test(char)) weight *= 2.5;
    total += weight;
    return total;
  });
  return times.map((time) => time / total);
};

const splitCharacters = (text: string) =>
  typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter().segment(text), (part) => part.segment)
    : Array.from(text);

/** Critically damped follow, which keeps up with a target that moves mid-flight. */
const smoothDamp = (
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number
) => {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return { value: target + (change + temp) * decay, velocity: (velocity - omega * temp) * decay };
};

const isHorizontal = (node: HTMLElement) => {
  const { display, flexDirection } = window.getComputedStyle(node);
  return display.includes("grid") || (display.includes("flex") && flexDirection.startsWith("row"));
};

type Overlay = {
  canvas: HTMLElement;
  scroller: HTMLElement;
  layer: HTMLElement;
  cursor: HTMLElement;
  cursorLabel: HTMLElement;
  ripple: HTMLElement;
  box: HTMLElement;
  boxLabel: HTMLElement;
};

type Focus = {
  node: HTMLElement;
  /** Where the cursor rests, relative to the node's top-left corner. */
  offsetX: number;
  offsetY: number;
  /** Whether the page scrolls to keep this element in view. */
  follow: boolean;
};

type QueueItem = { operations: EditorOperation[]; after?: () => void; cost: number };

type Deps = {
  dispatch: Dispatch<EditorAction>;
  /** Shares one undo step between everything in this run. */
  historyKey: string;
  getElements: () => EditorElement[];
};

export class BuildPlayer {
  /** Resolves once everything has played and the `finish` callback has run. */
  readonly finished: Promise<void>;

  private resolveFinished!: () => void;
  private queue: QueueItem[] = [];
  private currentCost = 0;
  private looping = false;
  private closed = false;
  private disposed = false;
  private skipped = false;
  private onFinished?: () => void;
  private wake: (() => void) | null = null;
  /** Finishes each running effect at once; used to skip and to clean up. */
  private effects = new Set<() => void>();
  private sectionsAdded = 0;

  private overlay: Overlay | null = null;
  private raf = 0;
  private lastFrame = 0;
  private lastUserScroll = 0;
  private focus: Focus | null = null;
  private cursor = { x: 0, y: 0, vx: 0, vy: 0 };
  private box = { x: 0, y: 0, width: 0, height: 0, shown: false };

  constructor(private deps: Deps) {
    this.finished = new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  /** Queue a batch; `after` runs once it has finished playing. */
  play(operations: EditorOperation[], after?: () => void) {
    this.queue.push({ operations, after, cost: estimate(operations) });
    this.run();
  }

  /** No more batches are coming. `onFinished` runs after the last one has played. */
  finish(onFinished?: () => void) {
    this.closed = true;
    this.onFinished = onFinished;
    this.run();
  }

  /** Show the rest of this run immediately. */
  skip() {
    this.skipped = true;
    this.settle();
    this.hideOverlay();
  }

  /** The editor is going away: stop without touching its state. */
  dispose() {
    this.disposed = true;
    this.settle();
    this.queue = [];
    this.teardown();
    this.resolveFinished();
  }

  // -- Queue --------------------------------------------------------------

  private get instant() {
    return (
      this.skipped ||
      this.disposed ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private run() {
    this.wake?.();
    this.wake = null;
    if (!this.looping) {
      this.looping = true;
      void this.loop();
    }
  }

  private async loop() {
    for (;;) {
      if (this.disposed) return;
      const item = this.queue.shift();
      if (!item) {
        if (this.closed) break;
        this.setCursorLabel("Thinking…");
        this.focus = null;
        await new Promise<void>((resolve) => {
          this.wake = resolve;
        });
        continue;
      }
      if (this.instant || !this.showOverlay()) {
        this.apply(item.operations);
      } else {
        this.setCursorLabel("AI");
        this.currentCost = item.cost;
        await this.playBatch(item.operations);
        this.currentCost = 0;
      }
      if (this.disposed) return;
      item.after?.();
    }

    await this.playFinale();
    if (this.disposed) return;
    this.hideOverlay();
    this.teardown();
    this.onFinished?.();
    this.resolveFinished();
  }

  /** Below 1 when playback has fallen behind the stream. */
  private get scale() {
    const backlog = this.queue.reduce((sum, item) => sum + item.cost, this.currentCost);
    return Math.max(MIN_SCALE, Math.min(1, MAX_BACKLOG_MS / Math.max(backlog, 1)));
  }

  private apply(operations: EditorOperation[]) {
    if (this.disposed || !operations.length) return;
    flushSync(() =>
      this.deps.dispatch({
        type: "APPLY_OPERATIONS",
        payload: { operations, historyKey: this.deps.historyKey },
      })
    );
  }

  private async playBatch(operations: EditorOperation[]) {
    const edits = operations.filter((op) => op.op !== "insert").length;
    const crowded = edits > CROWDED_EDITS;
    const pace = crowded ? CROWDED_EDITS / edits : 1;

    for (let i = 0; i < operations.length; i++) {
      if (this.instant) {
        this.apply(operations.slice(i));
        return;
      }
      const op = operations[i];
      if (op.op === "insert") await this.playInsert(op);
      else {
        if (op.op === "delete") await this.playDelete(op, pace, !crowded);
        else if (op.op === "move") await this.playMove(op, pace, !crowded);
        else await this.playEdit(op, pace, !crowded);
        this.currentCost -= TRAVEL_MS + EDIT_MS;
      }
    }
  }

  // -- Operations ---------------------------------------------------------

  private async playInsert(op: Extract<EditorOperation, { op: "insert" }>) {
    const parent = this.node(op.parentId);
    const row = !!parent && isHorizontal(parent);
    const replayLayout = row ? this.captureLayout([parent]) : null;

    this.apply([op]);
    const root = this.node(op.element.id);
    if (!root) return;

    const steps = planReveal(op.element).map((step) => ({
      step,
      node: this.node(step.element.id),
    }));
    steps.forEach(({ node }) => node?.setAttribute(HIDDEN_ATTR, ""));
    // Everything so far runs before the browser paints, so nothing flashes.

    if (op.parentId === "__body") this.sectionsAdded++;
    if (replayLayout) replayLayout();
    else this.grow(root);

    for (const { step, node } of steps) {
      if (this.instant) return;
      if (node) await this.reveal(step, node);
      this.currentCost -= stepCost(step);
    }
  }

  /** Open up the space for a new element so whatever is below slides down. */
  private grow(node: HTMLElement) {
    const { height, paddingTop, paddingBottom, marginTop, marginBottom } =
      window.getComputedStyle(node);
    void this.animate(
      node,
      [
        {
          height: "0px",
          minHeight: "0px",
          paddingTop: "0px",
          paddingBottom: "0px",
          marginTop: "0px",
          marginBottom: "0px",
          overflow: "hidden",
        },
        { height, paddingTop, paddingBottom, marginTop, marginBottom, overflow: "hidden" },
      ],
      GROW_MS * this.scale
    );
  }

  private async reveal(step: RevealStep, node: HTMLElement) {
    const { kind, painted, element } = step;
    const unhide = () => node.removeAttribute(HIDDEN_ATTR);
    const fadeIn = (ms: number) => this.animate(node, [{ opacity: 0, offset: 0 }], ms);
    const ms = step.ms * this.scale;

    if (kind === "structure") {
      unhide();
      return;
    }

    if (kind === "text") {
      const typing = this.prepareTyping(node);
      await this.moveTo(node, element.name, TRAVEL_MS * this.scale, {
        follow: true,
        anchor: typing?.caret,
      });
      unhide();
      if (painted) void fadeIn(ms * 0.6);
      await typing?.run(ms);
      return;
    }

    await this.moveTo(node, element.name, TRAVEL_MS * this.scale, { follow: true });
    this.pulse();
    unhide();

    switch (kind) {
      case "shell":
        await fadeIn(ms);
        break;
      case "button":
        await this.animate(
          node,
          [{ opacity: 0, transform: "translateY(8px) scale(0.94)", offset: 0 }],
          ms
        );
        break;
      case "image":
        await this.revealImage(node, ms);
        break;
      case "divider":
        await this.animate(
          node,
          [{ transform: "scaleX(0)", transformOrigin: "left center", offset: 0 }],
          ms
        );
        break;
      case "block":
        await this.animate(node, [{ opacity: 0, transform: "translateY(12px)", offset: 0 }], ms);
        break;
    }
  }

  private async revealImage(node: HTMLElement, ms: number) {
    const image = node.querySelector("img");
    if (image && !image.complete) {
      // Still downloading: show a shimmer and fade the photo in when it lands.
      node.setAttribute(LOADING_ATTR, "");
      const loaded = () => {
        node.removeAttribute(LOADING_ATTR);
        if (!this.instant) image.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      };
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", loaded, { once: true });
    }
    if (image) void this.animate(image, [{ transform: "scale(1.05)", offset: 0 }], ms);
    await this.animate(node, [{ clipPath: "inset(0 0 100% 0)", offset: 0 }, { clipPath: "inset(0 0 0% 0)" }], ms);
  }

  /** Move the page's content in view of the cursor, then change it. */
  private async playEdit(
    op: Extract<EditorOperation, { op: "update_styles" | "update_content" }>,
    pace: number,
    follow: boolean
  ) {
    const changesText = op.op === "update_content" && op.content.innerText !== undefined;
    const changesImage = op.op === "update_content" && op.content.src !== undefined;
    const visual = op.op === "update_styles" || changesText || changesImage;
    const node = op.id === "__body" ? null : this.node(op.id);
    if (!visual || !node || (!follow && !this.isInView(node))) {
      this.apply([op]);
      return;
    }

    const scale = this.scale * pace;
    await this.moveTo(node, this.nameOf(op.id), TRAVEL_MS * scale, { follow });
    this.pulse();
    this.apply([op]);
    if (this.instant) return;

    if (changesText) {
      const typing = this.prepareTyping(node);
      await typing?.run(typingTime(op.content.innerText ?? "") * scale);
    } else if (changesImage) {
      const refreshed = this.node(op.id);
      if (refreshed) await this.revealImage(refreshed, IMAGE_MS * scale);
    } else {
      // The stylesheet transitions the change itself while the build is running.
      await this.sleep(EDIT_MS * scale);
    }
  }

  private async playDelete(
    op: Extract<EditorOperation, { op: "delete" }>,
    pace: number,
    follow: boolean
  ) {
    const node = this.node(op.id);
    const parent = node?.parentElement?.closest<HTMLElement>("[data-element-id],[data-canvas-body]");
    if (!node || !parent || (!follow && !this.isInView(node))) {
      this.apply([op]);
      return;
    }

    const scale = this.scale * pace;
    await this.moveTo(node, this.nameOf(op.id), TRAVEL_MS * scale, { follow });
    this.pulse();

    const row = isHorizontal(parent);
    const { height, paddingTop, paddingBottom, marginTop, marginBottom } =
      window.getComputedStyle(node);
    const keyframes: Keyframe[] = row
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { height, paddingTop, paddingBottom, marginTop, marginBottom, opacity: 1, overflow: "hidden" },
          {
            height: "0px",
            minHeight: "0px",
            paddingTop: "0px",
            paddingBottom: "0px",
            marginTop: "0px",
            marginBottom: "0px",
            opacity: 0,
            overflow: "hidden",
          },
        ];
    await this.animate(node, keyframes, REMOVE_MS * scale, "forwards");

    const replayLayout = row ? this.captureLayout([parent]) : null;
    this.focus = null;
    this.apply([op]);
    replayLayout?.();
  }

  private async playMove(
    op: Extract<EditorOperation, { op: "move" }>,
    pace: number,
    follow: boolean
  ) {
    const node = this.node(op.id);
    if (!node) {
      this.apply([op]);
      return;
    }
    await this.moveTo(node, this.nameOf(op.id), TRAVEL_MS * this.scale * pace, { follow });
    this.pulse();
    if (this.instant) {
      this.apply([op]);
      return;
    }
    const oldParent = node.parentElement?.closest<HTMLElement>("[data-element-id],[data-canvas-body]");
    const replayLayout = this.captureLayout([oldParent ?? null, this.node(op.parentId)]);
    this.apply([op]);
    replayLayout();
    await this.sleep(FLIP_MS * this.scale * pace);
  }

  /** Remember where children sit; the result slides them from there to their new spots. */
  private captureLayout(parents: (HTMLElement | null)[]) {
    const before = new Map<string, DOMRect>();
    parents.forEach((parent) =>
      Array.from(parent?.children ?? []).forEach((child) => {
        const id = (child as HTMLElement).dataset.elementId;
        if (id) before.set(id, child.getBoundingClientRect());
      })
    );
    return () =>
      before.forEach((from, id) => {
        const node = this.node(id);
        if (!node) return;
        const to = node.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (!dx && !dy) return;
        void this.animate(
          node,
          [{ transform: `translate(${dx}px, ${dy}px)`, offset: 0 }],
          FLIP_MS * this.scale
        );
      });
  }

  // -- Effects ------------------------------------------------------------

  private animate(
    node: HTMLElement | HTMLImageElement,
    keyframes: Keyframe[],
    duration: number,
    fill?: FillMode
  ) {
    if (duration <= 0 || this.instant) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const animation = node.animate(keyframes, { duration, easing: EASE_OUT, fill });
      const stop = () => animation.cancel();
      const done = () => {
        this.effects.delete(stop);
        resolve();
      };
      animation.onfinish = done;
      animation.oncancel = done;
      this.effects.add(stop);
    });
  }

  private sleep(ms: number) {
    if (ms <= 0 || this.instant) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const stop = () => {
        clearTimeout(timer);
        this.effects.delete(stop);
        resolve();
      };
      const timer = setTimeout(stop, ms);
      this.effects.add(stop);
    });
  }

  /**
   * Split a text element's characters so it can be typed in its final layout:
   * unrevealed characters stay in place, just invisible, so lines never rewrap.
   * React keeps its own copy of the text and doesn't touch unchanged children,
   * and the full text goes back when typing ends.
   */
  private prepareTyping(node: HTMLElement) {
    const element = node.querySelector<HTMLElement>("[data-editable-text]");
    const text = element?.textContent;
    if (!element || !text) return null;

    const characters = splitCharacters(text);
    const shown = document.createTextNode("");
    const rest = document.createTextNode(text);
    const caret = document.createElement("span");
    caret.className = "build-caret";
    const hidden = document.createElement("span");
    hidden.style.visibility = "hidden";
    hidden.append(rest);
    element.replaceChildren(shown, caret, hidden);

    let frame = 0;
    let settled = false;
    let resolveRun = () => {};
    const finish = () => {
      settled = true;
      cancelAnimationFrame(frame);
      this.effects.delete(finish);
      element.textContent = text;
      resolveRun();
    };
    this.effects.add(finish);

    const run = (duration: number) => {
      if (settled) return Promise.resolve();
      return new Promise<void>((resolve) => {
        resolveRun = resolve;
        const timeline = typingTimeline(characters);
        const start = performance.now();
        let count = 0;
        const step = (now: number) => {
          const progress = duration > 0 ? (now - start) / duration : 1;
          if (progress >= 1 || !element.isConnected) {
            finish();
            return;
          }
          let next = count;
          while (next < characters.length && timeline[next] <= progress) next++;
          if (next !== count) {
            count = next;
            shown.data = characters.slice(0, count).join("");
            rest.data = characters.slice(count).join("");
          }
          frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      });
    };
    return { caret, run };
  }

  private pulse() {
    const { overlay } = this;
    if (!overlay || this.instant) return;
    overlay.ripple.animate(
      [
        { transform: "scale(0.2)", opacity: 0.55 },
        { transform: "scale(1)", opacity: 0 },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }

  /** Finish everything in flight and show whatever is still hidden. */
  private settle() {
    Array.from(this.effects).forEach((finish) => finish());
    this.effects.clear();
    const canvas = document.querySelector("[data-canvas-root]");
    canvas?.querySelectorAll(`[${HIDDEN_ATTR}],[${LOADING_ATTR}]`).forEach((node) => {
      node.removeAttribute(HIDDEN_ATTR);
      node.removeAttribute(LOADING_ATTR);
    });
  }

  private onVisibilityChange = () => {
    // Animation frames stop in a hidden tab, so don't leave the page half built.
    if (document.hidden) this.settle();
  };

  // -- Cursor and overlay -------------------------------------------------

  private node(id: string) {
    const canvas = this.overlay?.canvas ?? document.querySelector("[data-canvas-root]");
    if (id === "__body") return canvas?.querySelector<HTMLElement>("[data-canvas-body]") ?? null;
    return canvas?.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`) ?? null;
  }

  private nameOf(id: string) {
    return findElement(this.deps.getElements(), id)?.name ?? "";
  }

  /** The canvas runs past the bottom of the window, so measure what actually shows. */
  private viewOf(scroller: HTMLElement) {
    const rect = scroller.getBoundingClientRect();
    return { top: rect.top, bottom: Math.min(rect.bottom, window.innerHeight) };
  }

  private isInView(node: HTMLElement) {
    if (!this.overlay) return false;
    const view = this.viewOf(this.overlay.scroller);
    const rect = node.getBoundingClientRect();
    return rect.bottom > view.top && rect.top < view.bottom;
  }

  private showOverlay() {
    if (this.overlay) return true;
    flushSync(() => this.deps.dispatch({ type: "SET_BUILDING", payload: { building: true } }));
    const canvas = document.querySelector<HTMLElement>("[data-canvas-root]");
    const scroller = canvas?.querySelector<HTMLElement>("[data-canvas-body]");
    const pick = (name: string) => canvas?.querySelector<HTMLElement>(`[data-build-${name}]`);
    const layer = pick("overlay");
    const cursor = pick("cursor");
    const cursorLabel = pick("cursor-label");
    const ripple = pick("ripple");
    const box = pick("box");
    const boxLabel = pick("box-label");
    if (!canvas || !scroller || !layer || !cursor || !cursorLabel || !ripple || !box || !boxLabel) {
      this.hideOverlay();
      return false;
    }

    this.overlay = { canvas, scroller, layer, cursor, cursorLabel, ripple, box, boxLabel };
    scroller.addEventListener("wheel", this.onUserScroll, { passive: true });
    scroller.addEventListener("touchmove", this.onUserScroll, { passive: true });

    const bounds = canvas.getBoundingClientRect();
    this.cursor = { x: bounds.width / 2, y: 120, vx: 0, vy: 0 };
    this.box.shown = false;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    return true;
  }

  private hideOverlay() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.focus = null;
    if (this.overlay) {
      this.overlay.scroller.removeEventListener("wheel", this.onUserScroll);
      this.overlay.scroller.removeEventListener("touchmove", this.onUserScroll);
      this.overlay = null;
    }
    if (!this.disposed) {
      flushSync(() => this.deps.dispatch({ type: "SET_BUILDING", payload: { building: false } }));
    }
  }

  private teardown() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    cancelAnimationFrame(this.raf);
  }

  private onUserScroll = () => {
    this.lastUserScroll = performance.now();
  };

  private setCursorLabel(text: string) {
    if (this.overlay && this.overlay.cursorLabel.textContent !== text) {
      this.overlay.cursorLabel.textContent = text;
    }
  }

  /** Send the cursor to an element. A repeat visit to the same one takes no time. */
  private moveTo(
    node: HTMLElement,
    label: string,
    travelMs: number,
    { follow, anchor }: { follow: boolean; anchor?: HTMLElement }
  ) {
    const rect = node.getBoundingClientRect();
    const spot = anchor?.getBoundingClientRect();
    const sameTarget = this.focus?.node === node;
    this.focus = {
      node,
      follow,
      offsetX: spot
        ? spot.left - rect.left + 2
        : Math.min(rect.width / 2, 48 + Math.random() * 56),
      offsetY: spot ? spot.bottom - rect.top - 2 : Math.min(rect.height / 2, 28),
    };
    if (this.overlay && this.overlay.boxLabel.textContent !== label) {
      this.overlay.boxLabel.textContent = label;
    }
    return sameTarget ? Promise.resolve() : this.sleep(travelMs);
  }

  private frame = (now: number) => {
    const { overlay } = this;
    if (!overlay) return;
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    const bounds = overlay.canvas.getBoundingClientRect();

    if (this.focus && !this.focus.node.isConnected) this.focus = null;
    if (this.focus?.follow && now - this.lastUserScroll > USER_SCROLL_PAUSE_MS) {
      this.followWithPage(overlay.scroller, this.focus.node, dt);
    }

    const rect = this.focus?.node.getBoundingClientRect();
    if (this.focus && rect) {
      const smooth = Math.max(0.05, 0.13 * this.scale);
      // Different timing per axis bends the path like a moving hand.
      const x = smoothDamp(
        this.cursor.x,
        rect.left - bounds.left + this.focus.offsetX,
        this.cursor.vx,
        smooth,
        dt
      );
      const y = smoothDamp(
        this.cursor.y,
        rect.top - bounds.top + this.focus.offsetY,
        this.cursor.vy,
        smooth * 1.35,
        dt
      );
      this.cursor = { x: x.value, y: y.value, vx: x.velocity, vy: y.velocity };

      const k = this.box.shown ? 1 - Math.exp(-dt * 20) : 1;
      const left = rect.left - bounds.left;
      const top = rect.top - bounds.top;
      this.box = {
        shown: true,
        x: this.box.x + (left - this.box.x) * k,
        y: this.box.y + (top - this.box.y) * k,
        width: this.box.width + (rect.width - this.box.width) * k,
        height: this.box.height + (rect.height - this.box.height) * k,
      };
      overlay.box.style.opacity = "1";
      overlay.box.style.transform = `translate3d(${this.box.x}px, ${this.box.y}px, 0)`;
      overlay.box.style.width = `${this.box.width}px`;
      overlay.box.style.height = `${this.box.height}px`;
    } else {
      this.box.shown = false;
      overlay.box.style.opacity = "0";
    }

    overlay.cursor.style.transform = `translate3d(${this.cursor.x}px, ${this.cursor.y}px, 0)`;
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Ease the page so the active element sits inside the comfortable part of the view. */
  private followWithPage(scroller: HTMLElement, node: HTMLElement, dt: number) {
    const view = this.viewOf(scroller);
    const rect = node.getBoundingClientRect();
    const margin = Math.min(VIEW_MARGIN, (view.bottom - view.top) / 4);
    const above = rect.top - (view.top + margin);
    const below = rect.bottom - (view.bottom - margin);
    let distance = 0;
    if (above < 0) distance = above;
    else if (below > 0) distance = Math.min(below, above); // tall elements stay top-aligned
    if (!distance) return;

    const eased = distance * (1 - Math.exp(-dt * 6));
    scroller.scrollTop +=
      Math.abs(eased) < 1 ? Math.sign(distance) * Math.min(1, Math.abs(distance)) : eased;
  }

  /** Back to the top to show off a finished page, then the cursor leaves. */
  private async playFinale() {
    const { overlay } = this;
    if (!overlay || this.instant) return;
    this.focus = null;
    if (this.sectionsAdded >= 2) {
      overlay.scroller.scrollTo({ top: 0, behavior: "smooth" });
      await this.sleep(800);
    } else {
      await this.sleep(300);
    }
    await this.animate(overlay.layer, [{ opacity: 1 }, { opacity: 0 }], 220, "forwards");
  }
}
