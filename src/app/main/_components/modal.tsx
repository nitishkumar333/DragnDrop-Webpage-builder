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
    await fetch("http://localhost:3000/api/getFunnel/create-new-webpage", {
      method: "POST",
      body: JSON.stringify({
        name: input,
        id: funnelPageId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
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
            "bg-white rounded-lg hover:bg-gray-700 cursor-pointer transition-all duration-500 h-60",
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
          return (
            <div
              className="bg-white rounded-lg cursor-pointer h-60"
              key={Math.random()}
            >
              <Link href={`/main/${page.id}`}>
                <div
                  className={
                    "grid place-content-center h-full text-gray-600 transition-all duration-500"
                  }
                >
                  <Edit size={50} />
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default Modal;
