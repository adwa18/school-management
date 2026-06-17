"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { messagesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import {
  MessageSquare, Send, Loader2, X, Inbox,
  Reply, Trash2, Circle,
} from "lucide-react";

export default function MessagesPage() {
  const { user } = useAuthStore();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [page, setPage] = useState(1);
  const [compose, setCompose] = useState({ recipientEmail: "", subject: "", body: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["messages-inbox", page],
    queryFn: () => messagesApi.inbox({ page, limit: 20 }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => messagesApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages-inbox"] }),
  });

  const sendMutation = useMutation({
    mutationFn: (d: any) => messagesApi.send(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages-inbox"] });
      success("Message sent");
      setShowCompose(false);
      setCompose({ recipientEmail: "", subject: "", body: "" });
    },
    onError: () => error("Failed to send", "Could not send message. Please try again."),
  });

  const handleOpen = (msg: any) => {
    setSelected(msg);
    if (!msg.isRead) markReadMutation.mutate(msg.messageId);
  };

  const messages = data?.data ?? [];
  const meta = data?.meta;
  const unread = messages.filter((m: any) => !m.isRead).length;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-xl border bg-card overflow-hidden">
        {/* Sidebar — inbox list */}
        <div className={`flex flex-col ${selected ? "hidden md:flex" : "flex"} w-full md:w-80 border-r shrink-0`}>
          {/* Inbox header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-sm">Inbox</span>
              {unread > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {unread}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
            >
              <Send className="h-3 w-3" /> Compose
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto divide-y">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">No messages yet</p>
              </div>
            ) : (
              messages.map((msg: any) => (
                <button
                  key={msg.id}
                  onClick={() => handleOpen(msg)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selected?.id === msg.id ? "bg-muted/70" : ""} ${!msg.isRead ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!msg.isRead && <Circle className="h-2 w-2 mt-1.5 fill-primary text-primary shrink-0" />}
                    <div className={`flex-1 min-w-0 ${msg.isRead ? "ml-3.5" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!msg.isRead ? "font-semibold" : "font-medium"}`}>
                          {msg.message?.sender?.firstName} {msg.message?.sender?.lastName}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDateTime(msg.message?.createdAt)}
                        </span>
                      </div>
                      {msg.message?.subject && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.message.subject}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-0.5 opacity-70">
                        {msg.message?.body?.slice(0, 60)}…
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs">
              <button onClick={() => setPage(p => p - 1)} disabled={!meta.hasPrev}
                className="px-2 py-1 rounded hover:bg-muted disabled:opacity-40">← Prev</button>
              <span className="text-muted-foreground">{meta.page}/{meta.totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasNext}
                className="px-2 py-1 rounded hover:bg-muted disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {/* Main area — message detail */}
        <div className={`flex-1 flex flex-col ${!selected ? "hidden md:flex" : "flex"}`}>
          {selected ? (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelected(null)} className="md:hidden p-1.5 rounded-lg hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="font-semibold">{selected.message?.subject || "(No subject)"}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      From {selected.message?.sender?.firstName} {selected.message?.sender?.lastName} •{" "}
                      {formatDateTime(selected.message?.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Reply className="h-4 w-4" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose prose-sm max-w-none text-foreground">
                  <p className="whitespace-pre-wrap">{selected.message?.body}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-10" />
              <p className="font-medium">Select a message to read</p>
              <p className="text-sm mt-1">Or compose a new message</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">New Message</h2>
              <button onClick={() => setShowCompose(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                type="text"
                placeholder="Recipient name or email…"
                value={compose.recipientEmail}
                onChange={(e) => setCompose(p => ({ ...p, recipientEmail: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="Subject (optional)"
                value={compose.subject}
                onChange={(e) => setCompose(p => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                rows={6}
                placeholder="Write your message…"
                value={compose.body}
                onChange={(e) => setCompose(p => ({ ...p, body: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowCompose(false)}
                className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
              <button
                onClick={() => {
                  if (!compose.body.trim()) { error("Empty message", "Write a message before sending"); return; }
                  sendMutation.mutate({ recipientIds: [compose.recipientEmail], subject: compose.subject, body: compose.body });
                }}
                disabled={sendMutation.isPending || !compose.body.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {sendMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
