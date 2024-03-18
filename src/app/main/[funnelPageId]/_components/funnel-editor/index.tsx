"use client";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/providers/editor/editor-provider";
import clsx from "clsx";
import { EyeOff } from "lucide-react";
import React, { useEffect } from "react";
import Recursive from "./funnel-editor-components/recursive";

type Props = { funnelPageId: string; liveMode?: boolean };

const FunnelEditor = ({ funnelPageId, liveMode }: Props) => {
  const { dispatch, state } = useEditor();

  // console.log("------>" + JSON.stringify(state.editor.elements));

  useEffect(() => {
    if (liveMode) {
      dispatch({
        type: "TOGGLE_LIVE_MODE",
        payload: { value: true },
      });
    }
  }, [liveMode]);

  //CHALLENGE: make this more performant
  useEffect(() => {
    const fetchData = async () => {
      const result = await fetch(
        `https://${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/${funnelPageId}`
      );
      const response = await result.json();
      if (!response) return;

      dispatch({
        type: "LOAD_DATA",
        payload: {
          elements: response?.content ? JSON.parse(response?.content) : "",
          withLive: !!liveMode,
        },
      });
    };
    fetchData();
  }, []);

  const handleClick = () => {
    dispatch({
      type: "CHANGE_CLICKED_ELEMENT",
      payload: {},
    });
  };

  const handleUnpreview = () => {
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
    dispatch({ type: "TOGGLE_LIVE_MODE" });
  };
  return (
    <div
      className={clsx(
        "use-automation-zoom-in h-full mr-[385px] bg-white transition-all rounded-md",
        {
          "!p-0 !mr-0":
            state.editor.previewMode === true || state.editor.liveMode === true,
          "!w-[850px]": state.editor.device === "Tablet",
          "!w-[420px]": state.editor.device === "Mobile",
          "w-full": state.editor.device === "Desktop",
        }
      )}
      onClick={handleClick}
    >
      {state.editor.previewMode && state.editor.liveMode && (
        <Button
          variant={"ghost"}
          size={"icon"}
          className="w-6 h-6 bg-slate-600 p-[2px] fixed top-0 left-0 z-[100]"
          onClick={handleUnpreview}
        >
          <EyeOff />
        </Button>
      )}
      {Array.isArray(state.editor.elements) &&
        state.editor.elements.map((childElement) => {
          return <Recursive key={childElement.id} element={childElement} />;
        })}
    </div>
  );
};

export default FunnelEditor;

// [
//   {
//     content: [
//       {
//         content: [
//           {
//             content: {
//               src: "https://www.youtube.com/embed/A3l6YYkXzzg?si=zbcCeWcpq7Cwf8W1",
//             },
//             id: "8671293b-207e-4f1d-a35d-8035dcb93b95",
//             name: "Video",
//             styles: {},
//             type: "video",
//           },
//         ],
//         id: "4c5ce462-c576-45ec-a4e4-906fda15f1a5",
//         name: "Container",
//         styles: {
//           backgroundPosition: "center",
//           objectFit: "cover",
//           backgroundRepeat: "no-repeat",
//           textAlign: "left",
//           opacity: "100%",
//         },
//         type: "container",
//       },
//     ],
//     id: "__body",
//     name: "Body",
//     styles: { backgroundColor: "white", textAlign: "left" },
//     type: "__body",
//   },
// ];