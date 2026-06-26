import { cn } from "../../utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "info" | "danger" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

const variants = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  danger: "bg-red-500/15 text-red-400 border-red-500/20",
  neutral: "bg-[var(--bg-glass-heavy)] text-[var(--text-muted)] border-[var(--border-glass)]",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({ children, variant = "neutral", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
