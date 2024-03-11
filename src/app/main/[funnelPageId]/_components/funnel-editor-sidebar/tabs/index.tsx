import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, SettingsIcon } from "lucide-react";

const TabList = () => {
  return (
    <TabsList className=" flex items-center flex-col justify-evenly w-full bg-transparent h-fit gap-4 ">
      <TabsTrigger
        value="Settings"
        className="w-10 h-10 p-0 data-[state=active]:bg-muted"
      >
        <SettingsIcon />
      </TabsTrigger>
      <TabsTrigger
        value="Components"
        className="data-[state=active]:bg-muted w-10 h-10 p-0"
      >
        <Plus />
      </TabsTrigger>
    </TabsList>
  );
};

export default TabList;
