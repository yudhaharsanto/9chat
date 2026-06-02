"use client";

import { useState } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatLayout } from "@/components/chat/chat-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function HomePage() {
  const { isLoading: settingsLoading } = useSettings();
  const { currentUser, isLoading: authLoading, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Loading
  if (settingsLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in → user login
  if (!currentUser) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">9Chat</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
            </div>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoggingIn(true);
            setLoginError(false);
            const ok = await login(username, password);
            if (!ok) {
              setLoginError(true);
              toast.error("Invalid credentials");
            } else {
              toast.success("Welcome!");
            }
            setLoggingIn(false);
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setLoginError(false); }}
                className={loginError ? "ring-2 ring-destructive" : ""}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(false); }}
                className={loginError ? "ring-2 ring-destructive" : ""}
              />
              {loginError && <p className="text-xs text-destructive">Invalid username or password</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loggingIn}>
              {loggingIn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              Sign In
            </Button>
          </form>
          <p className="text-center text-[10px] text-muted-foreground">
            Contact admin to get an account
          </p>
        </div>
      </div>
    );
  }

  // All good → show chat
  return <ChatLayout />;
}
