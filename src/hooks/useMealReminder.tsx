import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MEAL_URL } from "@/lib/constants";

/**
 * Returns the meal reminder configuration for the current user.
 * - enabled: feature toggle (default false)
 * - url: user-defined URL, falls back to default MEAL_URL
 * Both are `null` while loading.
 */
export function useMealReminder() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string>(MEAL_URL);

  useEffect(() => {
    if (!user) { setEnabled(false); setUrl(MEAL_URL); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("meal_reminder_enabled, meal_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setEnabled(!!data?.meal_reminder_enabled);
        setUrl(data?.meal_url?.trim() ? data.meal_url : MEAL_URL);
      });
    return () => { cancelled = true; };
  }, [user]);

  return { enabled, url };
}
