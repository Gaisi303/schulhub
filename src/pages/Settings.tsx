import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Moon, Sun, UtensilsCrossed, ExternalLink, HardDrive } from "lucide-react";
import { MEAL_URL } from "@/lib/constants";
import { getUsedBytes, formatBytes, STORAGE_QUOTA_BYTES } from "@/lib/storageQuota";

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState("");
  const [mealEnabled, setMealEnabled] = useState(false);
  const [mealUrl, setMealUrl] = useState("");
  const [savingMealUrl, setSavingMealUrl] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, meal_reminder_enabled, meal_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        setMealEnabled(!!data?.meal_reminder_enabled);
        setMealUrl(data?.meal_url ?? "");
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Fehler beim Speichern");
    else toast.success("Gespeichert ✨");
  };

  const toggleMeal = async (val: boolean) => {
    if (!user) return;
    setMealEnabled(val); // optimistic
    const { error } = await supabase
      .from("profiles")
      .update({ meal_reminder_enabled: val })
      .eq("user_id", user.id);
    if (error) {
      setMealEnabled(!val);
      toast.error("Konnte nicht gespeichert werden");
    } else {
      toast.success(val ? "Essensanmeldung aktiviert 🍽️" : "Essensanmeldung deaktiviert");
    }
  };

  const saveMealUrl = async () => {
    if (!user) return;
    const trimmed = mealUrl.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("URL muss mit http:// oder https:// beginnen");
      return;
    }
    setSavingMealUrl(true);
    const { error } = await supabase
      .from("profiles")
      .update({ meal_url: trimmed || null })
      .eq("user_id", user.id);
    setSavingMealUrl(false);
    if (error) toast.error("Konnte nicht gespeichert werden");
    else toast.success(trimmed ? "URL gespeichert 🔗" : "Standard-URL wiederhergestellt");
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
          <p className="text-muted-foreground text-sm mt-1">Verwalte dein Konto und Aussehen</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Profil</h2>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Anzeigename</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          </div>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Funktionen</h2>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center shrink-0">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Essensanmeldung</p>
                <p className="text-xs text-muted-foreground">
                  Wöchentliche Erinnerung & Karte im Dashboard für die Schul-Essensbestellung
                </p>
              </div>
            </div>
            <Switch checked={mealEnabled} onCheckedChange={toggleMeal} />
          </div>

          {mealEnabled && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <Label htmlFor="meal-url" className="text-sm">Essensanmeldung-Link</Label>
              <p className="text-xs text-muted-foreground">
                Eigene URL für die Bestellseite. Leer = Standard ({new URL(MEAL_URL).hostname}).
              </p>
              <div className="flex gap-2">
                <Input
                  id="meal-url"
                  type="url"
                  placeholder={MEAL_URL}
                  value={mealUrl}
                  onChange={(e) => setMealUrl(e.target.value)}
                />
                <Button
                  onClick={saveMealUrl}
                  disabled={savingMealUrl}
                  variant="outline"
                  className="shrink-0"
                >
                  {savingMealUrl ? "…" : "Speichern"}
                </Button>
              </div>
              {mealUrl.trim() && (
                <a
                  href={mealUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Link testen <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Erscheinungsbild</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Farbschema</p>
              <p className="text-xs text-muted-foreground">Aktuell: {theme === "dark" ? "Dunkel" : "Hell"}</p>
            </div>
            <Button variant="outline" onClick={toggle}>
              {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              Wechseln
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
