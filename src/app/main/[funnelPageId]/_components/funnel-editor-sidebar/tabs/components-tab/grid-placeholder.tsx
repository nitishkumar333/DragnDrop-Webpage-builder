import { EditorBtns } from "@/lib/constants";
import { Grid2x2 } from "lucide-react";
import React from "react";

const GridPlaceholder = () => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return;
    e.dataTransfer.setData("componentType", type);
  };
  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, "grid")}
      className=" h-14 w-14 bg-muted rounded-lg flex items-center justify-center"
    >
      <Grid2x2 size={40} className="text-muted-foreground" />
    </div>
  );
};

export default GridPlaceholder;
