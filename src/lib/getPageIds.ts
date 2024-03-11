const getPageIds = async () => {
  const res = await fetch("http://localhost:3000/api/getFunnel/getAll", {
    cache: "no-cache",
  });
  const pages = await res.json();
  return pages;
};

export default getPageIds;
