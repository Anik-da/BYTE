import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Check, Trash2, Info, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useNotificationStore } from "../../stores/useNotificationStore";
import { cn } from "../../utils/cn";

const typeConfig = {
  info: { icon: <Info size={16} />, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: <CheckCircle size={16} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  warning: { icon: <AlertTriangle size={16} />, color: "text-amber-400", bg: "bg-amber-500/10" },
  error: { icon: <AlertCircle size={16} />, color: "text-red-400", bg: "bg-red-500/10" },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationCenter() {
  const open = useAppStore((s) => s.notificationCenterOpen);
  const setOpen = useAppStore((s) => s.setNotificationCenterOpen);
  const { notifications, markAsRead, dismiss, clearAll } = useNotificationStore();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed right-0 top-10 bottom-7 w-80 z-50 flex flex-col glass-heavy border-l border-[var(--border-glass)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-glass)]">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h3>
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Clear all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-heavy)] transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                  <Bell size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="py-1">
                  {notifications.map((notif) => {
                    const config = typeConfig[notif.type];
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={cn(
                          "px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-glass)] transition-colors group",
                          !notif.read && "bg-[var(--accent-muted)]/30"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", config.bg, config.color)}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{notif.title}</p>
                              <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">{timeAgo(notif.timestamp)}</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{notif.message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] px-2 py-1 rounded cursor-pointer"
                            >
                              <Check size={10} /> Mark read
                            </button>
                          )}
                          <button
                            onClick={() => dismiss(notif.id)}
                            className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-red-400 px-2 py-1 rounded cursor-pointer"
                          >
                            <X size={10} /> Dismiss
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
