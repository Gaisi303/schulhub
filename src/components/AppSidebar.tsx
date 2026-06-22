import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ListChecks, TrendingUp, Settings, GraduationCap, Sparkles,
  NotebookPen, Network, Calculator, CalendarDays, Home, Link2, ChefHat,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useArea } from "@/hooks/useArea";

const schoolItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Aufgaben", url: "/aufgaben", icon: ListChecks },
  { title: "Lernfortschritt", url: "/fortschritt", icon: TrendingUp },
  { title: "Kalender", url: "/kalender", icon: CalendarDays },
  { title: "Notenberechnung", url: "/notenberechnung", icon: Calculator },
  { title: "Notizen", url: "/notizen", icon: NotebookPen },
  { title: "Mindmaps", url: "/mindmaps", icon: Network },
  { title: "Lern-AI", url: "/lern-ai", icon: Sparkles },
  { title: "Einstellungen", url: "/einstellungen", icon: Settings },
];

const privateItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Aufgaben", url: "/aufgaben", icon: ListChecks },
  { title: "Kalender", url: "/kalender", icon: CalendarDays },
  { title: "Notizen", url: "/notizen", icon: NotebookPen },
  { title: "Links", url: "/links", icon: Link2 },
  { title: "Haushalts-AI", url: "/haushalts-ai", icon: ChefHat },
  { title: "Einstellungen", url: "/einstellungen", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { area } = useArea();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const items = area === "private" ? privateItems : schoolItems;
  const isPrivate = area === "private";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            {isPrivate ? (
              <Home className="h-5 w-5 text-primary-foreground" />
            ) : (
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight gradient-text">
                {isPrivate ? "PrivatHub" : "SchulHub"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {isPrivate ? "Dein privater Bereich" : "Dein Schulbegleiter"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={
                        active
                          ? "bg-gradient-primary !text-primary-foreground shadow-glow font-medium hover:!text-primary-foreground data-[active=true]:!text-primary-foreground [&>span]:!text-current [&>svg]:!text-current"
                          : "!text-sidebar-foreground hover:bg-sidebar-accent hover:!text-sidebar-accent-foreground [&>span]:!text-current [&>svg]:!text-current"
                      }
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 rounded-lg transition-all"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
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
