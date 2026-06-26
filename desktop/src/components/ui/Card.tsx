import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover = false, glow = false, onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-[var(--border-glass)] transition-all duration-300",
        "bg-[var(--card-bg)] backdrop-blur-xl",
        hover && "hover:bg-[var(--card-bg-hover)] hover:border-[var(--border-active)] cursor-pointer",
        glow && "hover:shadow-lg hover:shadow-[var(--accent-glow)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
