const getPageIds = async () => {
  const res = await fetch(
    `https://${process.env.NEXT_PUBLIC_DOMAIN}/api/getFunnel/getAll`,
    {
      cache: "no-cache",
    }
  );
  const pages = await res.json();
  return pages;
};

export default getPageIds;
