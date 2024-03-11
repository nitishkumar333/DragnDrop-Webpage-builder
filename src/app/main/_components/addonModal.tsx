"use client";
import { Contact2Icon, Link2Icon, TypeIcon, Youtube } from "lucide-react";
import { useEditor } from "@/providers/editor/editor-provider";
import {
  EditorBtns,
  defaultStyles,
  defaultStylesForText,
  defaultStylesForContainer,
} from "@/lib/constants";
import React from "react";
import { v4 } from "uuid";

const AddOnModal = ({ setPopoverIsOpen }: any) => {
  const { dispatch, state } = useEditor();

  const addHandler = (componentType: EditorBtns) => {
    const id = state.editor.selectedElement.id;
    switch (componentType) {
      case "text":
        dispatch({
          type: "APPEND_ELEMENT",
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
          type: "APPEND_ELEMENT",
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
          type: "APPEND_ELEMENT",
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
          type: "APPEND_ELEMENT",
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
          type: "APPEND_ELEMENT",
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
          type: "APPEND_ELEMENT",
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
          type: "APPEND_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [
                {
                  content: [],
                  id: v4(),
                  name: "Container",
                  styles: { ...defaultStyles, width: "100%" },
                  type: "container",
                },
                {
                  content: [],
                  id: v4(),
                  name: "Container",
                  styles: { ...defaultStyles, width: "100%" },
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
    }
    setPopoverIsOpen(false);
  };

  return (
    <div className="grid-rows-2 grid grid-flow-col w-80 p-4 border border-slate-600 rounded bg-background">
      {elements.map((element) => (
        <div
          key={element.id}
          className="flex-col items-center justify-center flex w-50 m-2 cursor-pointer"
          onClick={(e) => addHandler(element.id)}
        >
          {element.Component}
          <span className={`text-muted-foreground color-white`}>
            {element.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default AddOnModal;

const elements: {
  Component: React.ReactNode;
  label: string;
  id: EditorBtns;
}[] = [
  {
    Component: (
      <div className=" h-14 w-14 bg-muted rounded-lg flex items-center justify-center hover:outline hover:outline-1 text-holder">
        <TypeIcon size={40} className="text-muted-foreground" />
      </div>
    ),
    label: "Text",
    id: "text",
  },
  {
    Component: (
      <div className=" h-14 w-14 bg-muted/70 rounded-lg p-2 flex flex-row gap-[4px] border-slate-200 hover:border hover:border-1 col-holder">
        <div className="border-dashed border-[1px] h-full rounded-sm bg-muted border-slate-300 border-white/50 w-full" />
      </div>
    ),
    label: "Container",
    id: "container",
  },
  {
    Component: (
      <div className=" h-14 w-14 bg-muted/70 rounded-lg p-2 flex flex-row gap-[4px] border-slate-200 hover:border hover:border-1 col2-holder">
        <div className="border-dashed border-[1px] h-full rounded-sm bg-muted border-slate-300 border-white/50 w-full"></div>
        <div className="border-dashed border-[1px] h-full rounded-sm bg-muted border-slate-300 border-white/50 w-full"></div>
      </div>
    ),
    label: "2 Columns",
    id: "2Col",
  },
  {
    Component: (
      <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center border-slate-200 hover:border hover:border-1 video-holder">
        <Youtube size={40} className="text-muted-foreground" />
      </div>
    ),
    label: "Video",
    id: "video",
  },
  {
    Component: (
      <div className=" h-14 w-14 bg-muted rounded-lg flex items-center justify-center border-slate-200 hover:border hover:border-1 form-holder">
        <Contact2Icon size={40} className="text-muted-foreground" />
      </div>
    ),
    label: "Contact",
    id: "contactForm",
  },
  {
    Component: (
      <div className=" h-14 w-14 bg-muted rounded-lg flex items-center justify-center border-slate-200 hover:border hover:border-1 link-holder">
        <Link2Icon size={40} className="text-muted-foreground" />
      </div>
    ),
    label: "Link",
    id: "link",
  },
];
