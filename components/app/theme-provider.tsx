"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// One switch drives both systems: shadcn reads `class="dark"`, the figure kit
// reads `data-theme` on the same element (`.iso[data-theme="light"]`).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute={["class", "data-theme"]} defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
