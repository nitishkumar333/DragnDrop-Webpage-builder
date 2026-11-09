"use client";
import { ModeToggle } from "@/components/global/mode-toggle";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { AlertCircle, Layers, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import DeletePageDialog from "./_components/delete-page-dialog";
import NewPageDialog from "./_components/new-page-dialog";
import PageCard, { PageCardSkeleton, PageSummary } from "./_components/page-card";

const Page = () => {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PageSummary | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(apiUrl("/getFunnel/getAll"), { cache: "no-cache" });
      if (!res.ok) throw new Error(`Failed to load pages (${res.status})`);
      setPages(await res.json());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => setCreating(true);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_70%_380px_at_50%_-80px,hsl(var(--primary)/0.16),transparent)]">
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="h-4 w-4" />
            </span>
            Builder
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New page
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your pages</h1>
        <p className="mt-1.5 h-6 text-muted-foreground">
          {status === "ready" && pages.length > 0 && (
            <>
              {pages.length} {pages.length === 1 ? "page" : "pages"}, most recently edited first
            </>
          )}
        </p>

        {status === "error" ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border py-20 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="font-semibold">Your pages could not be loaded</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check that the backend is running, then try again.
              </p>
            </div>
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          </div>
        ) : status === "ready" && pages.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-5 rounded-2xl border border-dashed py-20 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/10">
              <Sparkles className="h-6 w-6 text-violet-500" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Build your first page</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Start from a blank canvas, or describe it and watch the AI build it.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New page
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {status === "loading" ? (
              Array.from({ length: 8 }, (_, i) => <PageCardSkeleton key={i} />)
            ) : (
              <>
                <button
                  type="button"
                  onClick={openCreate}
                  className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-muted-foreground transition duration-300 hover:border-primary/60 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted transition duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Plus className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">Create a new page</span>
                </button>
                {pages.map((page) => (
                  <PageCard key={page.id} page={page} onDelete={() => setPageToDelete(page)} />
                ))}
              </>
            )}
          </div>
        )}
      </main>

      <NewPageDialog open={creating} onOpenChange={setCreating} />
      <DeletePageDialog
        page={pageToDelete}
        onClose={() => setPageToDelete(null)}
        onDeleted={(id) => {
          setPages((current) => current.filter((p) => p.id !== id));
          setPageToDelete(null);
        }}
      />
    </div>
  );
};

export default Page;

export const revalidate = 0;
