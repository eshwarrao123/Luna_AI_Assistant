// /frontend/src/hooks/useSettings.ts
import { useCallback, useEffect, useState } from "react";

export interface LunaSettings {
    onboarding_complete: boolean;
    user_name: string;
    assistant_name: string;
    language: string;
    model: string;
    theme: string;
    font_size: string;
    response_style: string;
}

const BACKEND_URL = "http://localhost:8000";

export const DEFAULT_SETTINGS: LunaSettings = {
    onboarding_complete: false,
    user_name: "",
    assistant_name: "Luna",
    language: "English",
    model: "qwen2.5:7b",
    theme: "dark",
    font_size: "md",
    response_style: "balanced",
};

export function useSettings() {
    const [settings, setSettings] = useState<LunaSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BACKEND_URL}/settings`);
            const data = await res.json();
            setSettings({ ...DEFAULT_SETTINGS, ...data });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load settings.");
            setSettings(DEFAULT_SETTINGS);
        } finally {
            setLoading(false);
        }
    }, []);

    const saveSettings = useCallback(async (partial: Partial<LunaSettings>) => {
        try {
            const res = await fetch(`${BACKEND_URL}/settings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(partial),
            });
            const data = await res.json();
            const merged = { ...DEFAULT_SETTINGS, ...data };
            // This setState is what triggers App.tsx's theme/font useEffects
            setSettings(merged);
            return merged as LunaSettings;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save settings.");
            throw err;
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    return { settings, loading, error, loadSettings, saveSettings };
}