import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Mail, User as UserIcon, Save, Shield, Clock, Cpu } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useAuthStore } from "../stores/useAuthStore";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { GlassPanel } from "../components/ui/GlassPanel";

export function Profile() {
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const { user, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setCurrentPageTitle("Profile"); }, [setCurrentPageTitle]);

  const handleSave = () => {
    updateProfile({ name, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({ avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (!user) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <GlassPanel padding="lg">
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer animate-float" onClick={() => document.getElementById("avatar-input")?.click()}>
            <Avatar name={user.name} src={user.avatar} size="xl" status="online" />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={20} className="text-white" />
            </div>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{user.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Online</span>
            </div>
          </div>
        </div>
      </GlassPanel>


      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Shield size={18} />, label: "Role", value: "Admin", color: "text-[var(--accent)]" },
          { icon: <Clock size={18} />, label: "Member Since", value: "Today", color: "text-emerald-400" },
          { icon: <Cpu size={18} />, label: "Modules Used", value: "1", color: "text-amber-400" },
        ].map((stat) => (
          <GlassPanel key={stat.label} padding="md">
            <div className="flex items-center gap-3">
              <div className={`${stat.color} p-2 rounded-lg bg-[var(--bg-glass-heavy)]`}>{stat.icon}</div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{stat.value}</p>
              </div>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Edit Form */}
      <GlassPanel padding="lg">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Edit Profile</h3>
        <div className="space-y-4">
          <Input label="Display Name" value={name} onChange={(e) => setName(e.target.value)} icon={<UserIcon size={16} />} placeholder="Your name" />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} />} placeholder="your@email.com" />
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} icon={saved ? <Save size={16} /> : undefined}>
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
