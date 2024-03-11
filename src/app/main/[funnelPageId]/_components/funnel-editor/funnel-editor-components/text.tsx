"use client";
import AddOnModal from "@/app/main/_components/addonModal";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import { PlusCircle, Trash } from "lucide-react";
import React, { useState } from "react";

type Props = {
  element: EditorElement;
};

const TextComponent = (props: Props) => {
  const { dispatch, state } = useEditor();

  const [popoverIsOpen, setPopoverIsOpen] = useState<boolean | undefined>(
    false
  );

  const handleDeleteElement = () => {
    dispatch({
      type: "DELETE_ELEMENT",
      payload: { elementDetails: props.element },
    });
  };
  const styles = props.element.styles;

  const handleOnClickBody = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({
      type: "CHANGE_CLICKED_ELEMENT",
      payload: {
        elementDetails: props.element,
      },
    });
  };

  return (
    <div
      style={styles}
      className={clsx(
        "p-[2px] w-full m-[5px] relative text-[16px] transition-all",
        {
          "!border-blue-500 border-[2px]":
            state.editor.selectedElement.id === props.element.id,

          "!border-solid": state.editor.selectedElement.id === props.element.id,
          "border-dashed border-[2px] border-slate-300": !state.editor.liveMode,
        }
      )}
      onClick={handleOnClickBody}
    >
      {state.editor.selectedElement.id === props.element.id &&
        !state.editor.liveMode && (
          <Badge className="absolute -top-[23px] -left-[1px] rounded-none rounded-t-lg">
            {state.editor.selectedElement.name}
          </Badge>
        )}
      <span
        suppressContentEditableWarning={true}
        contentEditable={!state.editor.liveMode}
        onBlur={(e) => {
          const spanElement = e.target as HTMLSpanElement;
          dispatch({
            type: "UPDATE_ELEMENT",
            payload: {
              elementDetails: {
                ...props.element,
                content: {
                  innerText: spanElement.innerText,
                },
              },
            },
          });
        }}
      >
        {!Array.isArray(props.element.content) &&
          props.element.content.innerText}
      </span>

      {state.editor.selectedElement.id === props.element.id &&
        !state.editor.liveMode && (
          <Popover open={popoverIsOpen} onOpenChange={setPopoverIsOpen}>
            <div className="absolute -bottom-[30px] left-1/2 -translate-x-2/4 p-1.5 rounded-full cursor-pointer z-10 !text-white">
              <PopoverTrigger>
                <div className="bg-primary p-1.5 rounded-full">
                  <PlusCircle size={25} />
                </div>
              </PopoverTrigger>
              <PopoverContent style={{ width: "100%", padding: "0.5rem" }}>
                <AddOnModal setPopoverIsOpen={setPopoverIsOpen} />
              </PopoverContent>
            </div>
          </Popover>
        )}

      {state.editor.selectedElement.id === props.element.id &&
        !state.editor.liveMode && (
          <div className="absolute bg-primary px-2.5 py-1 text-xs font-bold -top-[25px] -right-[1px] rounded-none rounded-t-lg !text-white">
            <Trash
              className="cursor-pointer"
              size={16}
              onClick={handleDeleteElement}
            />
          </div>
        )}
    </div>
  );
};

export default TextComponent;
