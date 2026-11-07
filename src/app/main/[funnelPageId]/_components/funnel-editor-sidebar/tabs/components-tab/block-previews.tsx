import React from "react";

/** Tiny illustrative sketches of each block for the sidebar. */

const Bar = ({ className = "" }: { className?: string }) => (
  <div className={`h-1 rounded-full ${className}`} />
);

export const BLOCK_PREVIEWS: Record<string, React.ReactNode> = {
  navbar: (
    <div className="flex h-full items-center justify-between bg-white px-2">
      <div className="h-2 w-2 rounded-sm bg-slate-800" />
      <div className="flex items-center gap-1">
        <Bar className="w-3 bg-slate-300" />
        <Bar className="w-3 bg-slate-300" />
        <Bar className="w-3 bg-slate-300" />
        <div className="h-2 w-5 rounded-sm bg-indigo-500" />
      </div>
    </div>
  ),
  hero: (
    <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-indigo-50 to-pink-50">
      <Bar className="h-1.5 w-16 bg-slate-800" />
      <Bar className="w-12 bg-slate-400" />
      <div className="mt-0.5 flex gap-1">
        <div className="h-2 w-6 rounded-sm bg-indigo-500" />
        <div className="h-2 w-6 rounded-sm border border-slate-300 bg-white" />
      </div>
    </div>
  ),
  features: (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-white px-2">
      <Bar className="w-10 bg-slate-700" />
      <div className="flex w-full gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-5 flex-1 flex-col gap-0.5 rounded-sm border border-slate-200 p-0.5">
            <div className="h-1.5 w-1.5 rounded-sm bg-indigo-200" />
            <Bar className="w-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  ),
  testimonial: (
    <div className="flex h-full flex-col items-center justify-center gap-1 bg-slate-900">
      <Bar className="w-6 bg-amber-400" />
      <Bar className="w-16 bg-slate-200" />
      <Bar className="w-12 bg-slate-200" />
      <div className="h-2 w-2 rounded-full bg-indigo-400" />
    </div>
  ),
  pricing: (
    <div className="flex h-full items-center gap-1 bg-slate-50 px-2">
      {[false, true, false].map((hl, i) => (
        <div
          key={i}
          className={`flex h-9 flex-1 flex-col gap-0.5 rounded-sm p-1 ${hl ? "bg-indigo-500" : "border border-slate-200 bg-white"}`}
        >
          <Bar className={`w-3 ${hl ? "bg-white" : "bg-slate-700"}`} />
          <Bar className={`w-full ${hl ? "bg-indigo-300" : "bg-slate-200"}`} />
          <Bar className={`w-full ${hl ? "bg-indigo-300" : "bg-slate-200"}`} />
        </div>
      ))}
    </div>
  ),
  grid: (
    <div className="grid h-full grid-cols-3 gap-0.5 bg-white p-1.5">
      {["bg-indigo-200", "bg-pink-200", "bg-green-200", "bg-amber-200", "bg-sky-200", "bg-purple-200"].map((c) => (
        <div key={c} className={`rounded-sm ${c}`} />
      ))}
    </div>
  ),
  cta: (
    <div className="flex h-full items-center bg-white p-1.5">
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-gradient-to-br from-indigo-500 to-violet-600">
        <Bar className="w-14 bg-white" />
        <div className="h-2 w-7 rounded-sm bg-white" />
      </div>
    </div>
  ),
  footer: (
    <div className="flex h-full items-start justify-between gap-2 bg-slate-900 p-2">
      <Bar className="w-6 bg-white" />
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <Bar className="w-4 bg-slate-300" />
            <Bar className="w-4 bg-slate-600" />
            <Bar className="w-4 bg-slate-600" />
          </div>
        ))}
      </div>
    </div>
  ),
};
