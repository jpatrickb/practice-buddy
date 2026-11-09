import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { load, save } from "./storage";

export type Mode = "light" | "dark" | "system";
export type Accent = "blue" | "forest" | "plum" | "amber";
export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "blue", label: "Blue", swatch: "oklch(0.48 0.13 255)" },
  { id: "forest", label: "Green", swatch: "oklch(0.46 0.1 155)" },
  { id: "plum", label: "Plum", swatch: "oklch(0.47 0.14 330)" },
  { id: "amber", label: "Gold", swatch: "oklch(0.55 0.12 60)" },
];

interface Ctx { mode: Mode; accent: Accent; setMode(m: Mode): void; setAccent(a: Accent): void }
const ThemeCtx = createContext<Ctx>(null as unknown as Ctx);
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => load("pb.theme.mode", "system"));
  const [accent, setAccent] = useState<Accent>(() => load("pb.theme.accent", "blue"));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const value = useMemo<Ctx>(
    () => ({
      mode, accent,
      setMode: (m) => { setMode(m); save("pb.theme.mode", m); },
      setAccent: (a) => { setAccent(a); save("pb.theme.accent", a); },
    }),
    [mode, accent],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
