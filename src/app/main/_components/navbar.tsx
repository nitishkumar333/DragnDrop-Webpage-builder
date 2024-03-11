import React from "react";

const Navbar = () => {
  return (
    <nav className="border-gray-200 dark:bg-gray-900 dark:border-gray-700">
      <div className="max-w-screen-xl flex items-center justify-between mx-auto p-4">
        <span className="self-center text-3xl font-semibold whitespace-nowrap dark:text-white mx-auto">
          WebPage Buidler
        </span>
      </div>
    </nav>
  );
};

export default Navbar;
