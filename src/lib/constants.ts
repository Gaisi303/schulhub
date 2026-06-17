export const SUBJECTS = [
  "Mathematik",
  "Deutsch",
  "Englisch",
  "Französisch",
  "Italienisch",
  "Spanisch",
  "Latein",
  "Griechisch",
  "Russisch",
  "Geschichte",
  "Geografie",
  "Politische Bildung",
  "Wirtschaftskunde",
  "Biologie",
  "Physik",
  "Chemie",
  "Informatik",
  "Digitale Grundbildung",
  "Religion",
  "Ethik",
  "Philosophie",
  "Psychologie",
  "Pädagogik",
  "Soziologie",
  "Gesundheitslehre",
  "Hauswirtschaft",
  "Werken",
  "Technisches Werken",
  "Textiles Werken",
  "Bildnerische Erziehung",
  "Kunstgeschichte",
  "Musik",
  "Musikerziehung",
  "Instrumentalunterricht",
  "Sport",
  "Bewegung und Sport",
  "Darstellende Geometrie",
  "Astronomie",
  "Recht",
  "Mediendesign",
  "Kunst",
  "Psychologie Wahlpflichtfach",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_COLORS: Record<string, string> = {
  Mathematik: "from-blue-500 to-cyan-500",
  Deutsch: "from-amber-500 to-orange-500",
  Englisch: "from-rose-500 to-pink-500",
  Geschichte: "from-yellow-600 to-amber-700",
  Biologie: "from-green-500 to-emerald-500",
  Physik: "from-violet-500 to-purple-500",
  Chemie: "from-teal-500 to-cyan-600",
  Informatik: "from-indigo-500 to-blue-600",
  Geografie: "from-lime-500 to-green-600",
  Religion: "from-stone-500 to-stone-700",
  Musik: "from-fuchsia-500 to-pink-600",
  Sport: "from-red-500 to-orange-600",
};

export const PRIORITY_META = {
  low: { label: "Niedrig", className: "bg-success/15 text-success border-success/30" },
  medium: { label: "Mittel", className: "bg-warning/15 text-warning border-warning/30" },
  high: { label: "Hoch", className: "bg-destructive/15 text-destructive border-destructive/30" },
} as const;

export const STATUS_META = {
  open: { label: "Offen", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Arbeit", className: "bg-accent/15 text-accent" },
  done: { label: "Erledigt", className: "bg-success/15 text-success" },
} as const;

export const TASK_TYPE_META = {
  homework: { label: "Hausübung", emoji: "📝", className: "bg-blue-500/15 text-blue-500 border-blue-500/30", dot: "bg-blue-500" },
  exam: { label: "Prüfung", emoji: "📚", className: "bg-red-500/15 text-red-500 border-red-500/30", dot: "bg-red-500" },
  revision: { label: "Wiederholung", emoji: "🔁", className: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500" },
  vocab: { label: "Vokabel", emoji: "🗣️", className: "bg-purple-500/15 text-purple-500 border-purple-500/30", dot: "bg-purple-500" },
  other: { label: "Sonstiges", emoji: "📌", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
} as const;

export type TaskType = keyof typeof TASK_TYPE_META;

export const TIMETABLE_URL = "https://gymzwettl.webuntis.com/timetable/my-student?date=2026-04-27";
export const MEAL_URL = "https://www.gymnasium-zwettl.ac.at/essen/essen.php?login=1";
