import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the meal reminder feature is enabled for the current user.
 * `null` while loading.
 */
export function useMealReminder() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setEnabled(false); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("meal_reminder_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEnabled(!!data?.meal_reminder_enabled);
      });
    return () => { cancelled = true; };
  }, [user]);

  return enabled;
}
