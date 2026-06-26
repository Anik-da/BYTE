import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "../../stores/useAppStore";
import { useNotificationStore } from "../../stores/useNotificationStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { Avatar } from "../ui/Avatar";

export function TopBar() {
  const currentPageTitle = useAppStore((s) => s.currentPageTitle);
  const setNotificationCenterOpen = useAppStore((s) => s.setNotificationCenterOpen);
  const notificationCenterOpen = useAppStore((s) => s.notificationCenterOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex items-center justify-between h-12 px-6 bg-transparent flex-shrink-0">
      {/* Left: Page Title */}
      <motion.h2
        key={currentPageTitle}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-lg font-semibold text-[var(--text-primary)]"
      >
        {currentPageTitle}
      </motion.h2>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button
          onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-heavy)] transition-all cursor-pointer"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--accent)] text-[10px] font-bold text-white flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </button>

        {/* User Avatar */}
        {user && (
          <div className="flex items-center gap-2">
            <Avatar name={user.name} size="sm" status="online" />
          </div>
        )}
      </div>
    </div>
  );
}
