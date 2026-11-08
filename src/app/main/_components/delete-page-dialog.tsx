"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { forgetChat } from "@/lib/ai/chat-storage";
import { apiUrl } from "@/lib/api";
import { Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import type { PageSummary } from "./page-card";

type Props = {
  /** The page being confirmed; null closes the dialog. */
  page: PageSummary | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

const DeletePageDialog = ({ page, onClose, onDeleted }: Props) => {
  const [deleting, setDeleting] = useState(false);
  // Blocks a second click at once; state only updates on the next render.
  const inFlight = useRef(false);
  // Keeps the name on screen while the dialog animates closed.
  const shown = useRef(page);
  if (page) shown.current = page;
  const name = shown.current?.name || "Untitled page";

  const confirm = async () => {
    if (!page || inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/getFunnel/${encodeURIComponent(page.id)}`), {
        method: "DELETE",
      });
      // A 404 means it's already gone, which is what was asked for.
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed (${res.status})`);
      forgetChat(page.id);
      onDeleted(page.id);
      toast("Page deleted", { description: name });
    } catch {
      toast("Could not delete the page", { description: "Please try again." });
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={!!page}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
    >
      <DialogContent
        role="alertdialog"
        className="w-[calc(100%-2rem)] max-w-md gap-5 rounded-2xl sm:rounded-2xl"
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Delete this page?</DialogTitle>
          <DialogDescription>
            <span className="break-words font-medium text-foreground">{name}</span> and its
            public site link will be permanently removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="ghost" disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            className="gap-2"
            onClick={confirm}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeletePageDialog;
