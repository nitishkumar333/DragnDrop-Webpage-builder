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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setInitialAiPrompt } from "@/lib/ai/initial-prompt";
import { apiUrl } from "@/lib/api";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";
import { v4 } from "uuid";

const IDEAS = [
  {
    label: "Coffee roaster",
    prompt: "A landing page for a specialty coffee roaster in Portland",
  },
  {
    label: "Photographer",
    prompt: "A portfolio site for a wedding photographer",
  },
  {
    label: "Restaurant",
    prompt: "A homepage for a family-run Italian restaurant",
  },
  {
    label: "SaaS app",
    prompt: "A landing page for a time-tracking app, with pricing",
  },
];

/** Lives inside the dialog content, so closing the dialog clears it. */
const NewPageForm = ({ onCancel }: { onCancel: () => void }) => {
  const router = useRouter();
  const [nameInput, setNameInput] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const prompt = description.trim();
  const name = nameInput.trim() || prompt.slice(0, 60);

  const create = async () => {
    if (!name || creating) return;
    setCreating(true);
    const id = v4();
    try {
      const response = await fetch(apiUrl("/getFunnel/create-new-webpage"), {
        method: "POST",
        body: JSON.stringify({ name, id }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`Create failed (${response.status})`);
      if (prompt) setInitialAiPrompt(id, prompt);
      // The dialog stays up, still spinning, until the editor has loaded.
      router.push(`/main/${id}`);
    } catch {
      setCreating(false);
      toast("Could not create the page", { description: "Please try again." });
    }
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="new-page-name">Page name</Label>
        <Input
          id="new-page-name"
          value={nameInput}
          maxLength={120}
          placeholder="e.g. Spring launch"
          onChange={(e) => setNameInput(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="new-page-description" className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          Describe it for the AI
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="new-page-description"
          value={description}
          rows={4}
          maxLength={4000}
          className="resize-none"
          placeholder="What is the page for, and who is it for?"
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              create();
            }
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((idea) => (
            <button
              key={idea.label}
              type="button"
              onClick={() => setDescription(idea.prompt)}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {idea.label}
            </button>
          ))}
        </div>
      </div>

      <DialogFooter className="gap-2 sm:space-x-0">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name || creating} className="gap-2">
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            prompt && <Sparkles className="h-4 w-4" />
          )}
          {prompt ? "Build with AI" : "Create blank page"}
        </Button>
      </DialogFooter>
    </form>
  );
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const NewPageDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-lg gap-5 rounded-2xl sm:rounded-2xl">
      <DialogHeader className="text-left">
        <DialogTitle className="text-xl">Create a new page</DialogTitle>
        <DialogDescription>
          Start from a blank canvas, or describe it and watch the AI build it.
        </DialogDescription>
      </DialogHeader>
      <NewPageForm onCancel={() => onOpenChange(false)} />
    </DialogContent>
  </Dialog>
);

export default NewPageDialog;
