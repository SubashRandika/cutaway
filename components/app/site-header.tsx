import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";

export const APP_NAME = "Cutaway";
export const APP_TAGLINE = "How machines work, cut open";

// A cube with its front corner cut away: the app's whole idea in one mark.
function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4Z" />
      <path d="M12 12v9.2M12 12 4 7.4" opacity=".55" />
      <path d="M12 12 16 9.7v4.6L12 16.6" fill="currentColor" fillOpacity=".14" />
      <path d="M16 9.7 20 7.4M16 14.3l4 2.3" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-5! self-center!" />
      <Link href="/" className="flex items-center gap-2.5 rounded-md px-1 py-1 text-foreground">
        <Mark />
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
          <span className="mt-1 hidden text-xs text-muted-foreground sm:block">{APP_TAGLINE}</span>
        </span>
      </Link>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
