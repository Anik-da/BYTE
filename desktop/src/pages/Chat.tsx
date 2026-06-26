import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Plus, Search, FolderPlus, Pin, Trash2, Edit2, Send,
  Paperclip, StopCircle, RefreshCw, Cpu, AlertCircle, X, ChevronRight,
  ChevronDown, Copy, Terminal, Database, FileText, CheckCircle
} from "lucide-react";
import { AIService, ChatMessage } from "../services/aiService";
import { DatabaseService } from "../services/dbService";
import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";

interface Conversation {
  id: string;
  title: string;
  folderId: string | null;
  pinned: boolean;
  modelId: string;
  provider: string;
  messages: ChatMessage[];
  tokenCount: number;
}

interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
}

const PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "gemini", name: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-flash"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet", "claude-3-haiku"] },
  { id: "ollama", name: "Ollama (Local)", models: ["llama3", "mistral", "phi3"] },
  { id: "lmstudio", name: "LM Studio", models: ["local-model"] },
  { id: "openrouter", name: "OpenRouter", models: ["meta-llama/llama-3-70b-instruct"] },
  { id: "azure", name: "Azure OpenAI", models: ["azure-gpt-4"] },
  { id: "custom", name: "Custom Local", models: ["custom-model"] }
];

export function Chat() {
  const { user } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const activeFolderId = null;

  // Active chat controls
  const [inputPrompt, setInputPrompt] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; path: string }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]);
  const [selectedModel, setSelectedModel] = useState(PROVIDERS[0].models[0]);
  
  // Streaming state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const abortCleanupRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Settings / connection tester
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");

  // Load chat histories on mount
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const chats = await DatabaseService.loadChat(1);
        if (chats && chats.length > 0) {
          const mapped: Conversation[] = chats.map(c => ({
            id: c.id,
            title: c.title,
            folderId: null,
            pinned: false,
            modelId: c.model_id,
            provider: "openai",
            messages: [],
            tokenCount: 0
          }));
          setConversations(mapped);
          setActiveChatId(mapped[0].id);
        } else {
          // Initialize a first chat session
          createNewChat();
        }
      } catch (err) {
        console.error("Failed to load conversation history:", err);
      }
    }
    loadData();
  }, [user]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, streamBuffer]);

  const activeChat = conversations.find(c => c.id === activeChatId) || null;

  const createNewChat = () => {
    const newId = `chat-${Date.now()}`;
    const newChat: Conversation = {
      id: newId,
      title: `Conversation ${conversations.length + 1}`,
      folderId: activeFolderId,
      pinned: false,
      modelId: selectedModel,
      provider: selectedProvider.id,
      messages: [],
      tokenCount: 0
    };
    setConversations(prev => [newChat, ...prev]);
    setActiveChatId(newId);
  };

  const createNewFolder = () => {
    const name = prompt("Enter folder name:");
    if (!name) return;
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      collapsed: false
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(conversations[1]?.id || null);
    }
  };

  const togglePinConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const renameConversation = (id: string) => {
    const active = conversations.find(c => c.id === id);
    if (!active) return;
    const newTitle = prompt("Rename conversation:", active.title);
    if (!newTitle) return;
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  const testConnection = async () => {
    setTestStatus("testing");
    const success = await AIService.testConnection(
      selectedProvider.id,
      selectedModel
    );
    if (success) {
      setTestStatus("success");
      toast.success("Connection to AI provider successful!");
    } else {
      setTestStatus("failed");
      toast.error("Failed to connect. Check local model engine or API credentials.");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  const handleAttachFile = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await invoke<string | null>("show_file_picker", {
        title: "Attach file to Conversation context",
        isFolder: false
      });
      if (path) {
        const name = path.split(/[\\/]/).pop() || path;
        setAttachments(prev => [...prev, { name, path }]);
        toast.success(`Attached: ${name}`);
      }
    } catch (e) {
      // Fallback mock attachment
      const mockNames = ["report.pdf", "main.rs", "data.xlsx"];
      const randName = mockNames[Math.floor(Math.random() * mockNames.length)];
      setAttachments(prev => [...prev, { name: randName, path: `C:/mock/${randName}` }]);
      toast.success(`Mock attached: ${randName}`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const stopGeneration = () => {
    if (abortCleanupRef.current) {
      abortCleanupRef.current();
      abortCleanupRef.current = null;
    }
    setIsGenerating(false);
    if (activeChatId && streamBuffer) {
      saveMessageToState(activeChatId, "assistant", streamBuffer);
      setStreamBuffer("");
    }
    toast.success("Generation stopped.");
  };

  const saveMessageToState = (chatId: string, role: "user" | "assistant", content: string) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === chatId) {
          const updatedMessages = [...c.messages, { role, content }];
          return {
            ...c,
            messages: updatedMessages,
            tokenCount: c.tokenCount + Math.ceil(content.length / 4)
          };
        }
        return c;
      })
    );
  };

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || !activeChatId) return;

    const userQuery = inputPrompt;
    setInputPrompt("");
    setAttachments([]);

    // Add user message to state
    saveMessageToState(activeChatId, "user", userQuery);

    const chatSession = conversations.find(c => c.id === activeChatId);
    if (!chatSession) return;

    // Build message thread including previous history
    const messageHistory: ChatMessage[] = [
      ...chatSession.messages,
      { role: "user", content: userQuery }
    ];

    setIsGenerating(true);
    setStreamBuffer("");

    try {
      const cleanFn = await AIService.chatStream(
        selectedProvider.id,
        selectedModel,
        messageHistory,
        { temperature: 0.7, stream: true },
        "session-master-seed",
        (chunk) => {
          setStreamBuffer(prev => prev + chunk);
        },
        () => {
          setIsGenerating(false);
          setStreamBuffer(currentBuffer => {
            saveMessageToState(activeChatId, "assistant", currentBuffer);
            // Sync with local-first database
            DatabaseService.saveChat(
              activeChatId,
              1,
              chatSession.title,
              selectedModel,
              JSON.stringify([...messageHistory, { role: "assistant", content: currentBuffer }])
            );
            return "";
          });
          abortCleanupRef.current = null;
        }
      );
      abortCleanupRef.current = cleanFn;
    } catch (e) {
      setIsGenerating(false);
      toast.error("Failed to fetch response from model.");
    }
  };

  const handleRegenerateResponse = () => {
    if (!activeChat || activeChat.messages.length < 2) return;
    
    // Remove last assistant message
    const updatedMessages = [...activeChat.messages];
    if (updatedMessages[updatedMessages.length - 1].role === "assistant") {
      updatedMessages.pop();
    }
    
    setConversations(prev =>
      prev.map(c => (c.id === activeChat.id ? { ...c, messages: updatedMessages } : c))
    );
    
    // Get last user query
    const lastUserQuery = updatedMessages[updatedMessages.length - 1]?.content || "";
    if (lastUserQuery) {
      setInputPrompt(lastUserQuery);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Custom Markdown & Code Highlighter Parser
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const lines = part.split("\n");
        const headerLine = lines[0].replace("```", "").trim();
        const language = headerLine || "code";
        const codeText = lines.slice(1, -1).join("\n");
        
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-[var(--border-default)] bg-[var(--bg-glass-heavy)] font-mono text-xs">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-glass-heavy)] border-b border-[var(--border-default)] text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5 uppercase font-semibold text-[10px]">
                <Terminal size={12} />
                {language}
              </span>
              <button
                onClick={() => handleCopyText(codeText)}
                className="p-1 hover:text-[var(--accent)] hover:bg-[var(--bg-glass-light)] rounded transition cursor-pointer"
              >
                <Copy size={13} />
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-[var(--text-primary)]">
              <code>{codeText}</code>
            </pre>
          </div>
        );
      }

      // Simple Table parser
      if (part.includes("|") && part.split("\n").some(line => line.trim().startsWith("|"))) {
        const lines = part.split("\n");
        return (
          <div key={index} className="overflow-x-auto my-3 border border-[var(--border-default)] rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--bg-glass-heavy)] border-b border-[var(--border-default)]">
                  {lines[0].split("|").filter(c => c.trim()).map((cell, idx) => (
                    <th key={idx} className="px-3 py-2 font-semibold text-[var(--text-primary)]">{cell.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.slice(2).filter(l => l.trim().startsWith("|")).map((line, rIdx) => (
                  <tr key={rIdx} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-glass-light)]">
                    {line.split("|").filter(c => c.trim()).map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-1.5 text-[var(--text-secondary)]">{cell.trim()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed text-sm">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* 1. Left Sidebar: Conversations & Folders */}
      <div className="w-64 border-r border-[var(--border-default)] bg-[var(--sidebar-bg)] flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-[var(--border-default)] flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" size={14} />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createNewChat}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold py-1.5 rounded-lg transition duration-200 cursor-pointer"
            >
              <Plus size={14} />
              New Chat
            </button>
            <button
              onClick={createNewFolder}
              className="p-1.5 border border-[var(--border-default)] hover:bg-[var(--bg-glass-heavy)] text-[var(--text-primary)] rounded-lg transition duration-200 cursor-pointer"
              title="New Folder"
            >
              <FolderPlus size={15} />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {folders.map(folder => (
            <div key={folder.id} className="space-y-0.5">
              <button
                onClick={() => {
                  setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, collapsed: !f.collapsed } : f));
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {folder.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <span>{folder.name}</span>
              </button>
              {!folder.collapsed && conversations.filter(c => c.folderId === folder.id).map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                    activeChatId === chat.id
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "hover:bg-[var(--bg-glass-heavy)] text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="text-xs truncate font-medium">{chat.title}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Uncategorized conversations */}
          <div className="space-y-0.5 pt-2 border-t border-[var(--border-default)]/30">
            {filteredConversations.filter(c => !c.folderId).map(chat => (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                  activeChatId === chat.id
                    ? "bg-[var(--accent-muted)] text-[var(--accent)] font-medium"
                    : "hover:bg-[var(--bg-glass-heavy)] text-[var(--text-secondary)]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={13} className="flex-shrink-0 opacity-70" />
                  <span className="text-xs truncate select-none">{chat.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => togglePinConversation(chat.id, e)}
                    className="p-0.5 hover:bg-[var(--bg-glass-heavy)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded"
                  >
                    <Pin size={11} className={chat.pinned ? "fill-current" : ""} />
                  </button>
                  <button
                    onClick={() => renameConversation(chat.id)}
                    className="p-0.5 hover:bg-[var(--bg-glass-heavy)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={(e) => deleteConversation(chat.id, e)}
                    className="p-0.5 hover:bg-[var(--bg-glass-heavy)] text-[var(--text-muted)] hover:text-red-500 rounded"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Right Workspace Pane: Active Conversation & Controls */}
      <div className="flex-1 flex flex-col bg-[var(--bg-glass-light)] overflow-hidden">
        {/* Workspace Header: Provider Selector & Connection indicator */}
        <div className="h-14 px-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-glass-medium)]">
          <div className="flex items-center gap-3">
            <Cpu size={16} className="text-[var(--accent)]" />
            <div className="flex items-center gap-2 bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-lg px-2.5 py-1 text-xs">
              <select
                value={selectedProvider.id}
                onChange={(e) => {
                  const prov = PROVIDERS.find(p => p.id === e.target.value)!;
                  setSelectedProvider(prov);
                  setSelectedModel(prov.models[0]);
                }}
                className="bg-transparent text-[var(--text-primary)] font-medium focus:outline-none cursor-pointer"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id} className="bg-[var(--bg-glass-heavy)] text-[var(--text-primary)]">{p.name}</option>
                ))}
              </select>
              <div className="h-4 w-[1px] bg-[var(--border-default)]" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                {selectedProvider.models.map(m => (
                  <option key={m} value={m} className="bg-[var(--bg-glass-heavy)] text-[var(--text-primary)]">{m}</option>
                ))}
              </select>
            </div>
            <button
              onClick={testConnection}
              disabled={testStatus === "testing"}
              className="px-2.5 py-1 bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-[10px] uppercase font-semibold tracking-wider transition duration-200 cursor-pointer disabled:opacity-50"
            >
              {testStatus === "testing" ? "Testing..." : "Test Link"}
            </button>
            {testStatus === "success" && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
                <CheckCircle size={10} /> Online
              </span>
            )}
            {testStatus === "failed" && (
              <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold uppercase tracking-wider">
                <AlertCircle size={10} /> Timeout
              </span>
            )}
          </div>

          {activeChat && (
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
              <Database size={12} />
              <span>Est. Tokens: {activeChat.tokenCount}</span>
            </div>
          )}
        </div>

        {/* Message Log Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeChat?.messages.length === 0 && !streamBuffer && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-6 shadow-xl"
              >
                <MessageSquare className="mx-auto text-[var(--accent)] mb-3" size={32} />
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">AI OS Workspace</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  This console is wired natively to your local and cloud AI providers. All inputs/outputs are indexed in your secure SQLite engine.
                </p>
              </motion.div>
            </div>
          )}

          {activeChat?.messages.map((msg, index) => (
            <div
              key={index}
              className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3.5 shadow-lg border ${
                  msg.role === "user"
                    ? "bg-[var(--accent-muted)]/20 border-[var(--accent)]/30 text-[var(--text-primary)]"
                    : "bg-[var(--bg-glass-heavy)] border-[var(--border-default)] text-[var(--text-secondary)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase font-bold tracking-wider opacity-60">
                  <span>{msg.role === "user" ? "User Console" : "BYTE Engine"}</span>
                </div>
                <div>{renderMessageContent(msg.content)}</div>
              </div>
            </div>
          ))}

          {/* Streaming display */}
          {streamBuffer && (
            <div className="flex w-full justify-start">
              <div className="max-w-[85%] rounded-xl p-3.5 shadow-lg border bg-[var(--bg-glass-heavy)] border-[var(--border-default)] text-[var(--text-secondary)]">
                <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase font-bold tracking-wider opacity-60">
                  <span>BYTE Engine (streaming)</span>
                </div>
                <div>{renderMessageContent(streamBuffer)}</div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Display Area */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 bg-[var(--bg-glass-heavy)] border-t border-[var(--border-default)] flex flex-wrap gap-2">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2 py-1 bg-[var(--accent-muted)]/20 border border-[var(--accent)]/30 rounded-md text-[10px] text-[var(--accent)]"
              >
                <FileText size={12} />
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="hover:text-red-500 transition cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Workspace Footer Prompt controls */}
        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-glass-medium)]">
          <div className="flex items-end gap-2.5 bg-[var(--bg-glass-heavy)] border border-[var(--border-default)] rounded-xl p-2.5 focus-within:border-[var(--accent)] transition-all">
            <button
              onClick={handleAttachFile}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-light)] rounded-lg transition duration-200 cursor-pointer"
              title="Attach File/Context"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask BYTE anything (e.g. read folder config, generate system log summary)..."
              className="flex-1 bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none h-9 max-h-32 py-1 leading-normal"
            />
            
            <div className="flex gap-1.5">
              {isGenerating ? (
                <button
                  onClick={stopGeneration}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition duration-200 cursor-pointer"
                  title="Stop Generation"
                >
                  <StopCircle size={16} />
                </button>
              ) : (
                activeChat && activeChat.messages.length > 0 && (
                  <button
                    onClick={handleRegenerateResponse}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-light)] rounded-lg transition duration-200 cursor-pointer"
                    title="Regenerate Last Response"
                  >
                    <RefreshCw size={14} />
                  </button>
                )
              )}

              <button
                onClick={handleSendMessage}
                disabled={!inputPrompt.trim() && !isGenerating}
                className="p-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white rounded-lg transition duration-200 cursor-pointer"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Chat;
