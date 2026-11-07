import { apiUrl } from "@/lib/api";

const getPageIds = async () => {
  const res = await fetch(
    apiUrl("/getFunnel/getAll"),
    {
      cache: "no-cache",
    }
  );
  const pages = await res.json();
  return pages;
};

export default getPageIds;
