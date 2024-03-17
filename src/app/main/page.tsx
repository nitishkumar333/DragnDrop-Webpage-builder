"use client";
import React, { useEffect, useState } from "react";
import Modal from "./_components/modal";
import Loading from "@/components/global/loading";

const Page = () => {
  const [pages, setPage] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const getPageIds = async () => {
      const res = await fetch("http://localhost:3000/api/getFunnel/getAll", {
        cache: "no-cache",
      });
      const pages = await res.json();
      setPage(pages);
      setLoading(false);
    };
    getPageIds();
  }, []);
  return (
    <>
      {loading && (
        <div className="h-full w-full flex justify-center mt-10">
          <Loading />
        </div>
      )}
      {!loading && (
        <div>
          <Modal pages={pages} />
        </div>
      )}
    </>
  );
};

export default Page;
