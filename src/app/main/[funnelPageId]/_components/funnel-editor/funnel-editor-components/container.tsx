"use client";
import { Badge } from "@/components/ui/badge";
import {
  EditorBtns,
  defaultStyles,
  defaultStylesForText,
  defaultStylesForContainer,
} from "@/lib/constants";
import { EditorElement, useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import React, { useState } from "react";
import { v4 } from "uuid";
import Recursive from "./recursive";
import { PlusCircle, Trash } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AddOnModal from "../../../../_components/addonModal";

type Props = { element: EditorElement };

const Container = ({ element }: Props) => {
  const GridDetails: EditorElement = {
    content: [
      {
        content: [],
        id: v4(),
        name: "Container",
        styles: {
          backgroundPosition: "center",
          objectFit: "cover",
          backgroundRepeat: "no-repeat",
          textAlign: "left",
          opacity: "100%",
          paddingTop: "16px",
          paddingBottom: "16px",
          paddingLeft: "16px",
          paddingRight: "16px",
          marginTop: "0px",
          marginBottom: "0px",
          marginLeft: "0px",
          marginRight: "10px",
          width: "100%",
          height: "300px",
          backgroundImage: "url(https://placehold.co/400x300)",
        },
        type: "container",
      },
      {
        content: [],
        id: v4(),
        name: "Container",
        styles: {
          backgroundPosition: "center",
          objectFit: "cover",
          backgroundRepeat: "no-repeat",
          textAlign: "left",
          opacity: "100%",
          paddingTop: "16px",
          paddingBottom: "16px",
          paddingLeft: "16px",
          paddingRight: "16px",
          marginTop: "0px",
          marginBottom: "0px",
          marginLeft: "0px",
          marginRight: "10px",
          width: "100%",
          height: "300px",
          backgroundImage: "url(https://placehold.co/400x300)",
        },
        type: "container",
      },
      {
        content: [],
        id: v4(),
        name: "Container",
        styles: {
          backgroundPosition: "center",
          objectFit: "cover",
          backgroundRepeat: "no-repeat",
          textAlign: "left",
          opacity: "100%",
          paddingTop: "16px",
          paddingBottom: "16px",
          paddingLeft: "16px",
          paddingRight: "16px",
          marginTop: "0px",
          marginBottom: "0px",
          marginLeft: "0px",
          marginRight: "10px",
          width: "100%",
          height: "300px",
          backgroundImage: "url(https://placehold.co/400x300)",
        },
        type: "container",
      },
      {
        content: [],
        id: v4(),
        name: "Container",
        styles: {
          backgroundPosition: "center",
          objectFit: "cover",
          backgroundRepeat: "no-repeat",
          textAlign: "left",
          opacity: "100%",
          paddingTop: "16px",
          paddingBottom: "16px",
          paddingLeft: "16px",
          paddingRight: "16px",
          marginTop: "0px",
          marginBottom: "0px",
          marginLeft: "0px",
          marginRight: "0px",
          width: "100%",
          height: "300px",
          backgroundImage: "url(https://placehold.co/400x300)",
        },
        type: "container",
      },
    ],
    id: v4(),
    name: "Container",
    styles: {
      backgroundPosition: "center",
      objectFit: "cover",
      backgroundRepeat: "no-repeat",
      textAlign: "left",
      opacity: "100%",
      paddingTop: "10px",
      paddingBottom: "10px",
      paddingLeft: "10px",
      paddingRight: "10px",
      marginTop: "16px",
      marginBottom: "16px",
      marginLeft: "0px",
      marginRight: "0px",
      width: "100%",
      height: "fit-content",
      display: "flex",
    },
    type: "container",
  };
  const NavbarDetails: EditorElement = {
    content: [
      {
        content: { innerText: "YOUR LOGO HERE" },
        id: v4(),
        name: "Text",
        styles: {
          color: "black",
          backgroundPosition: "center",
          objectFit: "cover",
          backgroundRepeat: "no-repeat",
          textAlign: "left",
          opacity: "100%",
          paddingTop: "2px",
          paddingBottom: "2px",
          paddingLeft: "2px",
          paddingRight: "2px",
          marginTop: "0px",
          marginBottom: "0px",
          marginLeft: "0px",
          marginRight: "0px",
          fontSize: "16px",
          width: "100%",
          height: "47px",
          alignItems: "center",
          display: "flex",
        },
        type: "text",
      },
      {
        content: [
          {
            content: { innerText: "Home" },
            id: v4(),
            name: "Text",
            styles: {
              color: "black",
              backgroundPosition: "center",
              objectFit: "cover",
              backgroundRepeat: "no-repeat",
              textAlign: "center",
              opacity: "100%",
              paddingTop: "2px",
              paddingBottom: "2px",
              paddingLeft: "2px",
              paddingRight: "2px",
              marginTop: "5px",
              marginBottom: "5px",
              marginLeft: "0px",
              marginRight: "0px",
              fontSize: "16px",
              width: "100%",
              height: "auto",
              display: "block",
              alignItems: "center",
            },
            type: "text",
          },
          {
            content: { innerText: "About" },
            id: v4(),
            name: "Text",
            styles: {
              color: "black",
              backgroundPosition: "center",
              objectFit: "cover",
              backgroundRepeat: "no-repeat",
              textAlign: "center",
              opacity: "100%",
              paddingTop: "2px",
              paddingBottom: "2px",
              paddingLeft: "2px",
              paddingRight: "2px",
              marginTop: "5px",
              marginBottom: "5px",
              marginLeft: "0px",
              marginRight: "0px",
              fontSize: "16px",
              width: "100%",
              height: "auto",
            },
            type: "text",
          },
          {
            content: { innerText: "Portfolio" },
            id: v4(),
            name: "Text",
            styles: {
              color: "black",
              backgroundPosition: "center",
              objectFit: "cover",
              backgroundRepeat: "no-repeat",
              textAlign: "center",
              opacity: "100%",
              paddingTop: "2px",
              paddingBottom: "2px",
              paddingLeft: "2px",
              paddingRight: "2px",
              marginTop: "5px",
              marginBottom: "5px",
              marginLeft: "0px",
              marginRight: "0px",
              fontSize: "16px",
              width: "100%",
              height: "auto",
            },
            type: "text",
          },
          {
            content: { innerText: "Contact" },
            id: v4(),
            name: "Text",
            styles: {
              color: "black",
              backgroundPosition: "center",
              objectFit: "cover",
              backgroundRepeat: "no-repeat",
              textAlign: "center",
              opacity: "100%",
              paddingTop: "2px",
              paddingBottom: "2px",
              paddingLeft: "2px",
              paddingRight: "2px",
              marginTop: "5px",
              marginBottom: "5px",
              marginLeft: "0px",
              marginRight: "0px",
              fontSize: "16px",
              width: "100%",
              height: "auto",
            },
            type: "text",
          },
        ],
        id: v4(),
        name: "Container",
        styles: {
          backgroundPosition: "center",
          objectFit: "cover",
          backgroundRepeat: "no-repeat",
          textAlign: "left",
          opacity: "100%",
          paddingTop: "0px",
          paddingBottom: "0px",
          paddingLeft: "0px",
          paddingRight: "0px",
          marginTop: "0px",
          marginBottom: "0px",
          marginLeft: "0px",
          marginRight: "0px",
          width: "70%",
          height: "fit-content",
          display: "flex",
          alignItems: "normal",
        },
        type: "container",
      },
    ],
    id: v4(),
    name: "Container",
    styles: {
      backgroundPosition: "center",
      objectFit: "cover",
      backgroundRepeat: "no-repeat",
      textAlign: "left",
      opacity: "100%",
      paddingTop: "0px",
      paddingBottom: "0px",
      paddingLeft: "0px",
      paddingRight: "0px",
      marginTop: "16px",
      marginBottom: "0px",
      marginLeft: "0px",
      marginRight: "0px",
      width: "100%",
      height: "fit-content",
      display: "flex",
    },
    type: "container",
  };
  const { id, content, name, styles, type } = element;
  const { dispatch, state } = useEditor();

  const [popoverIsOpen, setPopoverIsOpen] = useState<boolean | undefined>(
    false
  );
  const handleOnDrop = (e: React.DragEvent, type: string) => {
    e.stopPropagation();
    const componentType = e.dataTransfer.getData("componentType") as EditorBtns;
    setPopoverIsOpen(false);
    switch (componentType) {
      case "text":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: { innerText: "Text Element" },
              id: v4(),
              name: "Text",
              styles: {
                color: "black",
                ...defaultStyles,
                ...defaultStylesForText,
              },
              type: "text",
            },
          },
        });
        break;
      case "link":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                innerText: "Link Element",
                href: "#",
              },
              id: v4(),
              name: "Link",
              styles: {
                color: "black",
                ...defaultStyles,
                ...defaultStylesForText,
              },
              type: "link",
            },
          },
        });
        break;
      case "video":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                src: "https://www.youtube.com/embed/9Je_iSH_fEU?si=nfMow0cJHeUhR2E8",
              },
              id: v4(),
              name: "Video",
              styles: {},
              type: "video",
            },
          },
        });
        break;
      case "container":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: v4(),
              name: "Container",
              styles: { ...defaultStyles, ...defaultStylesForContainer },
              type: "container",
            },
          },
        });
        break;
      case "contactForm":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: v4(),
              name: "Contact Form",
              styles: {},
              type: "contactForm",
            },
          },
        });
        break;
      case "paymentForm":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: v4(),
              name: "Contact Form",
              styles: {},
              type: "paymentForm",
            },
          },
        });
        break;
      case "2Col":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [
                {
                  content: [],
                  id: v4(),
                  name: "Container",
                  styles: { ...defaultStyles, ...defaultStylesForContainer },
                  type: "container",
                },
                {
                  content: [],
                  id: v4(),
                  name: "Container",
                  styles: { ...defaultStyles, ...defaultStylesForContainer },
                  type: "container",
                },
              ],
              id: v4(),
              name: "Two Columns",
              styles: { ...defaultStyles, display: "flex" },
              type: "2Col",
            },
          },
        });
        break;
      case "navbar":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: NavbarDetails,
          },
        });
        break;
      case "grid":
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: GridDetails,
          },
        });
        break;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    if (type === "__body") return;
    e.dataTransfer.setData("componentType", type);
  };

  const handleOnClickBody = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({
      type: "CHANGE_CLICKED_ELEMENT",
      payload: {
        elementDetails: element,
      },
    });
  };

  const handleDeleteElement = () => {
    dispatch({
      type: "DELETE_ELEMENT",
      payload: {
        elementDetails: element,
      },
    });
  };

  return (
    <div
      style={styles}
      className={clsx("relative p-4 transition-all group", {
        "max-w-full w-full": type === "container" || type === "2Col",
        "h-fit": type === "container",
        "h-full": type === "__body",
        "pb-24": type === "__body",
        "no-scrollbar": type === "__body",
        "overflow-scroll ": type === "__body",
        "flex flex-col md:!flex-row": type === "2Col",
        "!border-blue-500 border-[2px]":
          state.editor.selectedElement.id === id &&
          !state.editor.liveMode &&
          state.editor.selectedElement.type !== "__body",
        "!border-yellow-400 !border-4":
          state.editor.selectedElement.id === id &&
          !state.editor.liveMode &&
          state.editor.selectedElement.type === "__body",
        "!border-solid":
          state.editor.selectedElement.id === id && !state.editor.liveMode,
        "border-dashed border-[2px] border-slate-400": !state.editor.liveMode,
      })}
      onDrop={(e) => handleOnDrop(e, id)}
      onDragOver={handleDragOver}
      draggable={type !== "__body"}
      onClick={handleOnClickBody}
      onDragStart={(e) => handleDragStart(e, "container")}
    >
      <Badge
        className={clsx(
          "absolute -top-[23px] -left-[1px] rounded-none rounded-t-lg hidden",
          {
            block:
              state.editor.selectedElement.id === element.id &&
              !state.editor.liveMode,
          }
        )}
      >
        {element.name}
      </Badge>

      {state.editor.selectedElement.id === element.id &&
        !state.editor.liveMode &&
        state.editor.selectedElement.type !== "__body" && (
          <Popover open={popoverIsOpen} onOpenChange={setPopoverIsOpen}>
            <div className="absolute -bottom-[30px] left-1/2 -translate-x-2/4 p-1.5 rounded-full cursor-pointer z-10">
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

      {Array.isArray(content) &&
        content.map((childElement) => (
          <Recursive key={childElement.id} element={childElement} />
        ))}

      {state.editor.selectedElement.id === element.id &&
        !state.editor.liveMode &&
        state.editor.selectedElement.type !== "__body" && (
          <div className="absolute bg-primary px-2.5 py-1 text-xs font-bold -top-[25px] -right-[1px] rounded-none rounded-t-lg cursor-pointer">
            <Trash size={16} onClick={handleDeleteElement} />
          </div>
        )}
    </div>
  );
};

export default Container;
