import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Area = "school" | "private";

type Ctx = {
  area: Area;
  setArea: (a: Area) => void;
  toggle: () => void;
};

const AreaContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "schulhub.area";

export function AreaProvider({ children }: { children: ReactNode }) {
  const [area, setAreaState] = useState<Area>(() => {
    if (typeof window === "undefined") return "school";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "private" ? "private" : "school";
  });

  useEffect(() => {
    document.documentElement.dataset.area = area;
    window.localStorage.setItem(STORAGE_KEY, area);
  }, [area]);

  const setArea = (a: Area) => setAreaState(a);
  const toggle = () => setAreaState((p) => (p === "school" ? "private" : "school"));

  return (
    <AreaContext.Provider value={{ area, setArea, toggle }}>
      {children}
    </AreaContext.Provider>
  );
}

export function useArea() {
  const ctx = useContext(AreaContext);
  if (!ctx) throw new Error("useArea must be used within AreaProvider");
  return ctx;
}
