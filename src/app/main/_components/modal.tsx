"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { v4 } from "uuid";
import { Edit, Plus } from "lucide-react";
import clsx from "clsx";

type Props = {
  pages: { id: string }[];
};

const Modal = ({ pages }: Props) => {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const funnelPageId = v4();
  const createHandler = async () => {
    await fetch(
      `https://${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/create-new-webpage`,
      {
        method: "POST",
        body: JSON.stringify({
          name: input,
          id: funnelPageId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    router.push(`/main/${funnelPageId}`);
    toast("Success", {
      description: "Created New Webpage",
    });
  };
  return (
    <>
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 grid h-screen w-screen place-items-center bg-black bg-opacity-50 opacity-80 backdrop-blur-sm transition-opacity duration-300"
        ></div>
      )}

      {isOpen && (
        <div className="text-gray-700 bg-white shadow-md w-96 rounded-xl bg-clip-border fixed top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 ">
          <div className="flex flex-col gap-4 p-6">
            <div className="relative h-11 w-full min-w-[200px]">
              <input
                className="w-full h-full px-3 py-3 font-sans text-sm font-normal transition-all bg-transparent border rounded-md "
                placeholder="Enter Webpage Name"
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
          </div>
          <div className="p-6 pt-0">
            <button
              className="block w-full select-none rounded-lg bg-gradient-to-tr from-gray-900 to-gray-800 py-3 px-6 text-center align-middle font-sans text-xs font-bold text-white shadow-md shadow-gray-900/10 transition-all hover:shadow-lg hover:shadow-gray-900/40 active:opacity-[0.85]"
              type="button"
              onClick={createHandler}
            >
              CREATE
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-8">
        <div
          className={clsx(
            "rounded-lg hover:bg-gray-700 cursor-pointer transition-all duration-500 h-60 border-dashed border-2 border-primary",
            {
              "pointer-events-none": isOpen,
            }
          )}
          onClick={() => setIsOpen(true)}
        >
          <div
            className={clsx(
              "grid place-content-center h-full text-gray-600 hover:text-gray-100 transition-all duration-500 hover:scale-125",
              {
                "text-gray-100": isOpen,
                "scale-125": isOpen,
              }
            )}
          >
            <Plus size={70} />
          </div>
        </div>
        {pages?.map((page) => {
          let img: string = "";
          if (page.id === "2c7df268-e33e-4f64-95e6-f4bbf714ccff")
            img = "image1.png";
          else if (page.id === "72092bdc-4f1d-48b9-b79d-b2210226a016")
            img = "image2.png";
          else if (page.id === "97c44545-b74a-4dfa-ace6-754d47425488")
            img = "image3.png";
          const classess =
            "rounded-lg h-60 bg-center bg-cover relative border-solid border-2 border-primary";
          return (
            <div className={classess} key={Math.random()}>
              {img.length > 0 && (
                <>
                  <div className="absolute z-[-9] bg-black h-full w-full opacity-60"></div>
                  <img
                    src={img}
                    alt="image"
                    className="absolute z-[-10] text-white h-full w-full"
                  />
                </>
              )}
              <div className={"grid place-content-center h-full text-gray-600"}>
                <Link href={`/main/${page.id}`}>
                  <div
                    className={
                      "bg-primary p-2 rounded-lg hover:scale-110 transition-all duration-300 cursor-pointer"
                    }
                  >
                    <Edit size={35} color={"white"} />
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default Modal;
