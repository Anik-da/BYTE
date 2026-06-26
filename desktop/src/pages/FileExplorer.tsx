import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder, File, ArrowLeft, Search, Plus, Trash2, Edit2, LayoutGrid, List,
  Home, Download, FileText, Music, Image, Video
} from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { tauriService } from "../services/tauriService";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import type { FileInfo } from "../types";

export function FileExplorer() {
  const setCurrentPageTitle = useAppStore((s) => s.setCurrentPageTitle);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  
  // Quick Access Links
  const [shortcuts, setShortcuts] = useState<Array<{ name: string; path: string; icon: React.ReactNode }>>([]);

  useEffect(() => {
    setCurrentPageTitle("File Explorer");
    initShortcuts();
  }, [setCurrentPageTitle]);

  // Load shortcuts on mount
  async function initShortcuts() {
    try {
      const { desktopDir, documentDir, downloadDir, pictureDir, videoDir, audioDir } = await import("@tauri-apps/api/path");
      const list = [
        { name: "Desktop", path: await desktopDir(), icon: <Home size={16} /> },
        { name: "Documents", path: await documentDir(), icon: <FileText size={16} /> },
        { name: "Downloads", path: await downloadDir(), icon: <Download size={16} /> },
        { name: "Pictures", path: await pictureDir(), icon: <Image size={16} /> },
        { name: "Videos", path: await videoDir(), icon: <Video size={16} /> },
        { name: "Music", path: await audioDir(), icon: <Music size={16} /> },
      ];
      setShortcuts(list);
      
      // Default to downloads folder
      if (list[2]?.path) {
        navigateTo(list[2].path);
      }
    } catch (e) {
      console.error("Failed to load shortcuts:", e);
    }
  }

  const navigateTo = async (path: string) => {
    if (!path) return;
    try {
      const result = await tauriService.readDir(path);
      if (currentPath) {
        setHistory((prev) => [...prev, currentPath]);
      }
      setFiles(result);
      setCurrentPath(path);
      setSelectedFile(null);
    } catch (err) {
      await tauriService.showMessageDialog("Error Reading Directory", String(err), "error");
    }
  };

  const navigateBack = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    navigateTo(prev);
  };

  const handleCreateFolder = async () => {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;
    try {
      const newPath = `${currentPath}/${folderName}`;
      await tauriService.createDir(newPath);
      const result = await tauriService.readDir(currentPath);
      setFiles(result);
    } catch (err) {
      await tauriService.showMessageDialog("Error", String(err), "error");
    }
  };

  const handleDelete = async (file: FileInfo) => {
    const confirm = window.confirm(`Delete ${file.name}?`);
    if (!confirm) return;
    try {
      await tauriService.deleteFileOrDir(file.path);
      const result = await tauriService.readDir(currentPath);
      setFiles(result);
      if (selectedFile?.path === file.path) {
        setSelectedFile(null);
      }
    } catch (err) {
      await tauriService.showMessageDialog("Error", String(err), "error");
    }
  };

  const handleRename = async (file: FileInfo) => {
    const newName = prompt("Enter new name:", file.name);
    if (!newName) return;
    try {
      const newPath = `${currentPath}/${newName}`;
      await tauriService.renameFileOrDir(file.path, newPath);
      const result = await tauriService.readDir(currentPath);
      setFiles(result);
      setSelectedFile(null);
    } catch (err) {
      await tauriService.showMessageDialog("Error", String(err), "error");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-4 h-[calc(100vh-140px)]"
    >
      {/* File Explorer Sidebar shortcuts */}
      <GlassPanel padding="md" className="w-52 flex-shrink-0 flex flex-col gap-4">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Quick Access</h3>
        <div className="flex flex-col gap-1">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.name}
              onClick={() => navigateTo(shortcut.path)}
              className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors cursor-pointer ${
                currentPath === shortcut.path
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="opacity-80">{shortcut.icon}</span>
              {shortcut.name}
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* Main File View Section */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Navigation / Actions Bar */}
        <GlassPanel padding="sm" className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateBack}
              disabled={history.length === 0}
              icon={<ArrowLeft size={16} />}
            />
            {/* Breadcrumb Path */}
            <div className="text-xs font-mono text-[var(--text-muted)] truncate bg-[var(--bg-glass-heavy)] border border-[var(--border-glass)] px-3 py-1.5 rounded-lg flex-1">
              {currentPath || "Loading path..."}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              icon={<Search size={14} />}
              className="w-48 !mb-0"
            />
            <Button variant="ghost" size="sm" onClick={handleCreateFolder} icon={<Plus size={16} />} title="New Folder" />
            <div className="flex items-center rounded-lg bg-[var(--bg-glass)] p-1 border border-[var(--border-glass)]">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md cursor-pointer ${viewMode === "grid" ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md cursor-pointer ${viewMode === "list" ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </GlassPanel>

        {/* Files Grid / List */}
        <GlassPanel padding="none" className="flex-1 overflow-y-auto p-4 border border-[var(--border-glass)] rounded-xl">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-muted)]">
              <Folder size={48} className="stroke-[1] mb-2 opacity-50" />
              <p className="text-sm font-medium">Empty directory or no search match</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  onDoubleClick={() => file.is_dir && navigateTo(file.path)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer select-none group relative ${
                    selectedFile?.path === file.path
                      ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                      : "border-[var(--border-glass)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                  }`}
                >
                  <div className={`p-3 rounded-lg mb-2 ${file.is_dir ? "text-amber-400" : "text-sky-400"}`}>
                    {file.is_dir ? <Folder size={32} /> : <File size={32} />}
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate w-full px-1">
                    {file.name}
                  </span>
                  {!file.is_dir && (
                    <span className="text-[10px] text-[var(--text-muted)] mt-1">
                      {formatSize(file.size)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  onDoubleClick={() => file.is_dir && navigateTo(file.path)}
                  className={`flex items-center justify-between p-3 rounded-lg border-b border-[var(--border-glass)] text-left cursor-pointer transition-all ${
                    selectedFile?.path === file.path
                      ? "bg-[var(--accent-muted)] border-l-2 border-l-[var(--accent)]"
                      : "hover:bg-[var(--bg-glass)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={file.is_dir ? "text-amber-400" : "text-sky-400"}>
                      {file.is_dir ? <Folder size={18} /> : <File size={18} />}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                    {!file.is_dir && <span>{formatSize(file.size)}</span>}
                    <span>{new Date(file.modified * 1000).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Preview & Action Drawer Panel */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-64 flex-shrink-0"
          >
            <GlassPanel padding="md" className="h-full flex flex-col gap-6 border border-[var(--border-glass)]">
              <div className="flex flex-col items-center text-center">
                <div className={`p-4 rounded-xl bg-[var(--bg-glass-heavy)] mb-3 ${selectedFile.is_dir ? "text-amber-400" : "text-sky-400"}`}>
                  {selectedFile.is_dir ? <Folder size={40} /> : <File size={40} />}
                </div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] break-all px-2 w-full">
                  {selectedFile.name}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono break-all px-1">
                  {selectedFile.path}
                </p>
              </div>

              {/* Details List */}
              <div className="space-y-2 text-xs flex-1">
                <div className="flex justify-between border-b border-[var(--border-glass)] pb-1.5">
                  <span className="text-[var(--text-muted)]">Type</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedFile.is_dir ? "Directory" : "File"}</span>
                </div>
                {!selectedFile.is_dir && (
                  <div className="flex justify-between border-b border-[var(--border-glass)] pb-1.5">
                    <span className="text-[var(--text-muted)]">Size</span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatSize(selectedFile.size)}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-[var(--border-glass)] pb-1.5">
                  <span className="text-[var(--text-muted)]">Modified</span>
                  <span className="font-semibold text-[var(--text-primary)]">{new Date(selectedFile.modified * 1000).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRename(selectedFile)}
                  icon={<Edit2 size={12} />}
                >
                  Rename
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(selectedFile)}
                  icon={<Trash2 size={12} />}
                >
                  Delete
                </Button>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
