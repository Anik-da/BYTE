import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn("flex items-center gap-3 group cursor-pointer", disabled && "opacity-50 cursor-not-allowed", className)}
    >
      <div
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0",
          checked ? "bg-[var(--accent)]" : "bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)]"
        )}
      >
        <motion.div
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
        />
      </div>
      {(label || description) && (
        <div className="flex flex-col text-left">
          {label && <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>}
          {description && <span className="text-xs text-[var(--text-muted)]">{description}</span>}
        </div>
      )}
    </button>
  );
}
