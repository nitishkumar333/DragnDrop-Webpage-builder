import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers3, Plus, SettingsIcon } from "lucide-react";

const TABS = [
  { value: "Components", title: "Add components", Icon: Plus },
  { value: "Settings", title: "Style", Icon: SettingsIcon },
  { value: "Layers", title: "Layers", Icon: Layers3 },
];

const TabList = () => {
  return (
    <TabsList className="flex h-fit w-full flex-col items-center justify-evenly gap-4 bg-transparent pt-4">
      {TABS.map(({ value, title, Icon }) => (
        <TabsTrigger
          key={value}
          value={value}
          title={title}
          className="h-10 w-10 p-0 data-[state=active]:bg-muted"
        >
          <Icon />
        </TabsTrigger>
      ))}
    </TabsList>
  );
};

export default TabList;
