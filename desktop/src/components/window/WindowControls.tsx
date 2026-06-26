import { Minus, Square, X, Copy } from "lucide-react";
import { useWindowControls } from "../../hooks/useWindowControls";
import { cn } from "../../utils/cn";

export function WindowControls() {
  const { isMaximized, minimize, toggleMaximize, close } = useWindowControls();

  const buttons = [
    { icon: <Minus size={12} />, action: minimize, label: "Minimize", className: "hover:bg-white/10" },
    {
      icon: isMaximized ? <Copy size={11} /> : <Square size={11} />,
      action: toggleMaximize,
      label: isMaximized ? "Restore" : "Maximize",
      className: "hover:bg-white/10",
    },
    { icon: <X size={14} />, action: close, label: "Close", className: "hover:bg-red-500 hover:text-white" },
  ];

  return (
    <div className="flex items-center no-drag">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.action}
          aria-label={btn.label}
          className={cn(
            "w-11 h-9 flex items-center justify-center transition-colors duration-150",
            "text-[var(--text-secondary)]",
            btn.className
          )}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
