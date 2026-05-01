import { motion } from "framer-motion";
import { format, isPast, isToday, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, Clock, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_META, STATUS_META, SUBJECT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface Task {
  id: string;
  title: string;
  subject: string;
  due_date: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "done";
  description: string | null;
}

interface Props {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}

export function TaskCard({ task, onToggle, onEdit, onDelete }: Props) {
  const due = parseISO(task.due_date);
  const overdue = task.status !== "done" && isPast(due) && !isToday(due);
  const today = isToday(due);
  const done = task.status === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "glass rounded-2xl p-4 relative overflow-hidden group",
        overdue && "ring-2 ring-destructive/60",
        done && "opacity-60"
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", SUBJECT_COLORS[task.subject] || "from-primary to-primary-glow")} />

      <div className="flex items-start gap-3">
        <motion.button
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.1 }}
          onClick={() => onToggle(task)}
          className={cn(
            "mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
            done
              ? "bg-success border-success text-white"
              : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10"
          )}
        >
          {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </motion.button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("font-semibold leading-tight", done && "line-through")}>{task.title}</h3>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(task)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(task)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <Badge variant="outline" className="text-[10px] border-border/50 font-medium">
              {task.subject}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px]", PRIORITY_META[task.priority].className)}>
              {PRIORITY_META[task.priority].label}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] border-transparent", STATUS_META[task.status].className)}>
              {STATUS_META[task.status].label}
            </Badge>
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] ml-auto",
                overdue ? "text-destructive font-semibold" : today ? "text-warning font-medium" : "text-muted-foreground"
              )}
            >
              {overdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {format(due, "dd. MMM", { locale: de })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
