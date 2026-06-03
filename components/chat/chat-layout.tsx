"use client";

import { useState, useEffect } from "react";
import { ConversationSidebar } from "@/components/sidebar/conversation-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft, Moon, Sun, Settings, Menu, X } from "lucide-react";
import { useChatContext } from "@/components/providers/chat-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import Link from "next/link";
import { TokenIndicator } from "@/components/chat/token-indicator";

export function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const { activeConversation, activeProject, activeAgent } = useChatContext();
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileSidebar(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-full bg-background">
      {/* Desktop Sidebar */}
      {sidebarOpen && (
        <div className="hidden md:flex flex-shrink-0 w-[260px] border-r border-border/40">
          <div className="w-[260px]">
            <ConversationSidebar collapsed={false} />
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {mobileSidebar && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setMobileSidebar(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar shadow-xl md:hidden">
            <div className="relative h-full">
              <ConversationSidebar collapsed={false} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-3 h-8 w-8 rounded-lg"
                onClick={() => setMobileSidebar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex h-11 items-center justify-between border-b border-border/40 bg-background/80 px-3 md:px-4 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground md:hidden"
              onClick={() => setMobileSidebar(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Desktop sidebar toggle */}
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{sidebarOpen ? "Collapse" : "Expand"}</TooltipContent>
            </Tooltip>

            <div className="hidden md:block h-4 w-px bg-border/60" />

            {activeProject && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{activeProject.icon}</span>
                <span className="font-medium hidden sm:inline">{activeProject.name}</span>
                <span className="text-border/60 hidden sm:inline">/</span>
              </div>
            )}

            {activeAgent && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{activeAgent.icon}</span>
                <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px] md:max-w-[200px]">{activeAgent.name}</span>
              </div>
            )}

            {activeConversation && !activeAgent && (
              <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px] md:max-w-[200px]">
                {activeConversation.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {currentUser && <TokenIndicator userId={currentUser.id} />}
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
            {currentUser?.role === "admin" && (
              <Tooltip>
                <TooltipTrigger>
                  <Link href="/admin">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground">
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Admin</TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>

        <ChatArea />
      </div>
    </div>
  );
}
