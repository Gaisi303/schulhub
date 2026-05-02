import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Moon, Sun, UtensilsCrossed, ExternalLink } from "lucide-react";
import { MEAL_URL } from "@/lib/constants";

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState("");
  const [mealEnabled, setMealEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, meal_reminder_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        setMealEnabled(!!data?.meal_reminder_enabled);
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
