"use client";
import React from "react";

/**
 * The cursor and highlight shown while the AI builds the page. This only draws
 * them; BuildPlayer finds them through their data attributes and moves them
 * every frame, without going through React.
 */
const BuildOverlay = () => (
  <div
    data-build-overlay
    className="pointer-events-none absolute inset-0 z-[60] overflow-hidden"
    aria-hidden
  >
    <div
      data-build-box
      className="absolute left-0 top-0 rounded-[3px] opacity-0 outline outline-[1.5px] outline-violet-500 transition-opacity duration-200 will-change-transform"
    >
      <span
        data-build-box-label
        className="absolute -top-[19px] left-0 max-w-[220px] truncate rounded-t-[3px] bg-violet-500 px-1.5 py-px text-[10px] font-medium leading-4 text-white"
      />
    </div>
    <div data-build-cursor className="absolute left-0 top-0 will-change-transform">
      <span
        data-build-ripple
        className="absolute -left-5 -top-5 h-10 w-10 rounded-full bg-violet-500 opacity-0"
      />
      <svg
        width="22"
        height="24"
        viewBox="0 0 22 24"
        className="relative drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
      >
        <path
          d="M2 2l6.2 19 3.3-8 8.3-3.1L2 2z"
          className="fill-violet-600 stroke-white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span
        data-build-cursor-label
        className="absolute left-4 top-5 whitespace-nowrap rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-medium leading-4 text-white shadow-md"
      >
        AI
      </span>
    </div>
  </div>
);

export default BuildOverlay;
