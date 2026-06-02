"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Settings } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_SETTINGS: Settings = {
  routerUrl: "",
  routerApiKey: "",
  imgbbApiKey: "",
  enabledModels: [],
};

interface ModelAlias {
  [modelId: string]: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  isConfigured: boolean;
  isLoading: boolean;
  // Admin
  isAdmin: boolean;
  adminLogin: (password: string) => Promise<boolean>;
  adminLogout: () => void;
  changeAdminPassword: (newPassword: string) => Promise<boolean>;
  // Models
  enabledModels: string[];
  setEnabledModels: (models: string[]) => Promise<void>;
  modelsFilterActive: boolean;
  // Model aliases
  modelAliases: ModelAlias;
  setModelAliases: (aliases: ModelAlias) => Promise<void>;
  // Sync
  loadFromSupabase: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  isConfigured: false,
  isLoading: true,
  isAdmin: false,
  adminLogin: async () => false,
  adminLogout: () => {},
  changeAdminPassword: async () => false,
  enabledModels: [],
  setEnabledModels: async () => {},
  modelsFilterActive: false,
  modelAliases: {},
  setModelAliases: async () => {},
  loadFromSupabase: async () => {},
});

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadSettingsFromSupabase(): Promise<{
  patch: Partial<Settings>;
  enabledModels: string[] | null;
  modelAliases: ModelAlias;
}> {
  const supabase = createClient();
  const patch: Partial<Settings> = {};
  let enabledModelsArr: string[] | null = null;
  let modelAliasesObj: ModelAlias = {};
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "9router_url", "9router_api_key",
      "imgbb_api_key",
      "enabled_models", "model_aliases",
    ]);

  if (data) {
    const map = Object.fromEntries(data.map((r: { key: string; value: unknown }) => [r.key, r.value]));
    if (map["9router_url"]) patch.routerUrl = map["9router_url"] as string;
    if (map["9router_api_key"]) patch.routerApiKey = map["9router_api_key"] as string;
    if (map["imgbb_api_key"]) patch.imgbbApiKey = map["imgbb_api_key"] as string;

    if (map["enabled_models"] !== undefined && map["enabled_models"] !== null) {
      enabledModelsArr = map["enabled_models"] as string[];
    }
    if (map["model_aliases"] && typeof map["model_aliases"] === "object") {
      modelAliasesObj = map["model_aliases"] as ModelAlias;
    }
  }

  return { patch, enabledModels: enabledModelsArr, modelAliases: modelAliasesObj };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabledModels, setEnabledModelsState] = useState<string[]>([]);
  const [modelsFilterActive, setModelsFilterActive] = useState(false);
  const [modelAliases, setModelAliasesState] = useState<ModelAlias>({});

  // ── Bootstrap ──
  useEffect(() => {
    const init = async () => {
      // Restore admin session
      if (sessionStorage.getItem("9chat-admin") === "true") setIsAdmin(true);

      setMounted(true);

      // Load everything from Supabase (always, since env vars are set)
      try {
        const result = await loadSettingsFromSupabase();
        if (Object.keys(result.patch).length > 0) setSettings((prev) => ({ ...prev, ...result.patch }));

        if (result.enabledModels !== null) {
          setEnabledModelsState(result.enabledModels);
          setModelsFilterActive(true);
        } else {
          setModelsFilterActive(false);
        }
        setModelAliasesState(result.modelAliases);
      } catch {
        // Supabase might not be configured yet
      }

      setIsLoading(false);
    };
    init();
  }, []);

  // ── Update settings (only non-supabase fields) ──
  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── Reload from Supabase ──
  const loadFromSupabase = useCallback(async () => {
    try {
      const result = await loadSettingsFromSupabase();
      if (Object.keys(result.patch).length > 0) setSettings((prev) => ({ ...prev, ...result.patch }));
      if (result.enabledModels !== null) {
        setEnabledModelsState(result.enabledModels);
        setModelsFilterActive(true);
      } else {
        setModelsFilterActive(false);
      }
      if (Object.keys(result.modelAliases).length > 0) setModelAliasesState(result.modelAliases);
    } catch {}
  }, []);

  // ── Admin auth ──
  const adminLogin = useCallback(async (password: string): Promise<boolean> => {
    const hash = await sha256(password);

    // Try Supabase first
    try {
      const supabase = createClient();
      const { data } = await supabase.from("app_settings").select("value").eq("key", "admin_password").single();
      if (data?.value && hash === data.value) {
        setIsAdmin(true);
        sessionStorage.setItem("9chat-admin", "true");
        return true;
      }
    } catch {}

    // Fallback: default password "admin"
    const DEFAULT_ADMIN_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    if (hash === DEFAULT_ADMIN_HASH) {
      setIsAdmin(true);
      sessionStorage.setItem("9chat-admin", "true");
      return true;
    }

    return false;
  }, []);

  const adminLogout = useCallback(() => {
    setIsAdmin(false);
    sessionStorage.removeItem("9chat-admin");
  }, []);

  const changeAdminPassword = useCallback(async (newPassword: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "admin_password", value: await sha256(newPassword) }, { onConflict: "key" });
      return !error;
    } catch { return false; }
  }, []);

  // ── Enabled models ──
  const setEnabledModels = useCallback(async (models: string[]) => {
    setEnabledModelsState(models);
    setModelsFilterActive(true);
    try {
      const supabase = createClient();
      await supabase.from("app_settings").upsert({ key: "enabled_models", value: models }, { onConflict: "key" });
    } catch {}
  }, []);

  // ── Model aliases ──
  const setModelAliases = useCallback(async (aliases: ModelAlias) => {
    setModelAliasesState(aliases);
    try {
      const supabase = createClient();
      await supabase.from("app_settings").upsert({ key: "model_aliases", value: aliases }, { onConflict: "key" });
    } catch {}
  }, []);

  // isConfigured = only needs 9router (Supabase is always available via env)
  const isConfigured = !!(settings.routerUrl && settings.routerApiKey);

  if (!mounted) {
    return (
      <SettingsContext.Provider value={{
        settings: DEFAULT_SETTINGS, updateSettings: () => {}, isConfigured: false, isLoading: true,
        isAdmin: false, adminLogin: async () => false, adminLogout: () => {}, changeAdminPassword: async () => false,
        enabledModels: [], setEnabledModels: async () => {}, modelsFilterActive: false,
        modelAliases: {}, setModelAliases: async () => {},
        loadFromSupabase: async () => {},
      }}>
        {children}
      </SettingsContext.Provider>
    );
  }

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, isConfigured, isLoading,
      isAdmin, adminLogin, adminLogout, changeAdminPassword,
      enabledModels, setEnabledModels, modelsFilterActive,
      modelAliases, setModelAliases,
      loadFromSupabase,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
