"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FuelIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SCENES, hrefOf } from "@/lib/scenes";

const ICONS = { fuel: FuelIcon };

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Scenes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SCENES.map((scene) => {
                const href = hrefOf(scene);
                const Icon = ICONS[scene.icon];
                return (
                  <SidebarMenuItem key={scene.slug}>
                    <SidebarMenuButton asChild size="lg" isActive={pathname === href} tooltip={scene.title}>
                      <Link href={href} onClick={() => isMobile && setOpenMobile(false)}>
                        <Icon />
                        <span className="flex flex-col gap-0.5 leading-tight">
                          <span className="font-medium">{scene.title}</span>
                          <span className="text-xs text-muted-foreground">{scene.summary}</span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
