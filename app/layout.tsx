import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../components/iso/iso.css";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/app/theme-provider";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SiteHeader, APP_NAME, APP_TAGLINE } from "@/components/app/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `${APP_NAME}: ${APP_TAGLINE}. Interactive sectioned figures of real machines.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("iso font-sans", geist.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <SidebarProvider className="flex flex-col" style={{ "--header-height": "3.5rem" } as React.CSSProperties}>
              <SiteHeader />
              <div className="flex flex-1">
                <AppSidebar />
                <SidebarInset className="bg-(--anatomy-page)">{children}</SidebarInset>
              </div>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
