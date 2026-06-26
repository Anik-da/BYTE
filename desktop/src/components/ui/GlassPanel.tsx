import { cn } from "../../utils/cn";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  intensity?: "light" | "medium" | "heavy";
  padding?: "none" | "sm" | "md" | "lg";
}

const intensities = {
  light: "bg-[var(--bg-glass)] backdrop-blur-md",
  medium: "bg-[var(--bg-glass)] backdrop-blur-xl",
  heavy: "bg-[var(--bg-glass-heavy)] backdrop-blur-2xl",
};

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

export function GlassPanel({ children, className, intensity = "medium", padding = "md" }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-glass)]",
        intensities[intensity],
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
