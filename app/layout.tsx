import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font";
import { JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ChatProvider } from "@/components/providers/chat-provider";
import { ServiceWorkerRegistration } from "@/components/providers/sw-register";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "9Chat — AI Chat Assistant",
  description: "Personal AI chat interface powered by 9router",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "9Chat",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistMono.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">
        <ServiceWorkerRegistration />
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <ChatProvider>
                <TooltipProvider>
                  {children}
                  <Toaster richColors />
                </TooltipProvider>
              </ChatProvider>
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
