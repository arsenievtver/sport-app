import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAthleteAiChatThread,
  fetchAthleteAiChatMessages,
  fetchAthleteAiChatThreads,
  humanizeFetchError,
  sendAthleteAiChatMessage,
} from "@sport-app/api-client";
import {
  AI_CHAT_MAX_MESSAGE_LENGTH,
  type AthleteAiChatMessage,
  type AthleteAiChatThread,
} from "@sport-app/shared";
import "./athlete-chat.css";

type View = "threads" | "chat";

function formatThreadTitle(thread: AthleteAiChatThread): string {
  if (thread.title?.trim()) return thread.title.trim();
  return "Новый диалог";
}

function formatThreadDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function bubbleClassName(role: string): string {
  if (role === "user") {
    return "athlete-chat__bubble athlete-chat__bubble--user";
  }
  return "athlete-chat__bubble athlete-chat__bubble--assistant";
}

export function AthleteChatPanel() {
  const [view, setView] = useState<View>("threads");
  const [threads, setThreads] = useState<AthleteAiChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AthleteAiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    setError(null);
    try {
      const list = await fetchAthleteAiChatThreads();
      setThreads(list);
    } catch (err) {
      setError(humanizeFetchError(err));
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending, view]);

  const openThread = async (threadId: string) => {
    setActiveThreadId(threadId);
    setView("chat");
    setLoadingMessages(true);
    setError(null);
    try {
      const list = await fetchAthleteAiChatMessages(threadId);
      setMessages(list);
    } catch (err) {
      setError(humanizeFetchError(err));
      setMessages([]);
    } finally {
      setLoadingMessages(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const startNewThread = async () => {
    setError(null);
    try {
      const thread = await createAthleteAiChatThread({});
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
      setView("chat");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      setError(humanizeFetchError(err));
    }
  };

  const backToThreads = () => {
    setView("threads");
    setActiveThreadId(null);
    setMessages([]);
    setDraft("");
    void loadThreads();
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || !activeThreadId || sending) return;
    if (content.length > AI_CHAT_MAX_MESSAGE_LENGTH) {
      setError(`Сообщение слишком длинное (макс. ${AI_CHAT_MAX_MESSAGE_LENGTH})`);
      return;
    }

    setSending(true);
    setError(null);
    setDraft("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const result = await sendAthleteAiChatMessage(activeThreadId, { content });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        result.user_message,
        result.assistant_message,
      ]);
      setThreads((prev) => {
        const updated = prev.map((t) =>
          t.id === activeThreadId
            ? {
                ...t,
                title: t.title ?? content.slice(0, 80),
                updated_at: result.assistant_message.created_at,
              }
            : t,
        );
        return [...updated].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      });
    } catch (err) {
      setDraft(content);
      setError(humanizeFetchError(err));
      try {
        const list = await fetchAthleteAiChatMessages(activeThreadId);
        setMessages(list);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    } finally {
      setSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (view === "threads") {
    return (
      <div className="athlete-overlay-screen athlete-chat">
        <div className="athlete-chat__toolbar">
          <p className="athlete-chat__hint text-muted">
            Спроси про план, тренировки, вес, питание или WHOOP
          </p>
          <button type="button" className="athlete-chat__new-btn" onClick={() => void startNewThread()}>
            Новый чат
          </button>
        </div>
        {error ? <p className="athlete-chat__error">{error}</p> : null}
        {loadingThreads ? (
          <p className="text-muted">Загрузка диалогов…</p>
        ) : threads.length === 0 ? (
          <div className="athlete-chat__empty glass glass--panel">
            <p>Пока нет диалогов</p>
            <button type="button" className="athlete-chat__new-btn" onClick={() => void startNewThread()}>
              Начать
            </button>
          </div>
        ) : (
          <ul className="athlete-chat__thread-list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className="athlete-chat__thread-item glass glass--panel"
                  onClick={() => void openThread(thread.id)}
                >
                  <span className="athlete-chat__thread-title">{formatThreadTitle(thread)}</span>
                  <span className="athlete-chat__thread-date text-muted">
                    {formatThreadDate(thread.updated_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="athlete-overlay-screen athlete-chat athlete-chat--conversation">
      <div className="athlete-chat__toolbar">
        <button type="button" className="athlete-chat__back-btn" onClick={backToThreads}>
          К списку
        </button>
      </div>
      {error ? <p className="athlete-chat__error">{error}</p> : null}
      <div className="athlete-chat__messages" ref={listRef}>
        {loadingMessages ? <p className="text-muted">Загрузка…</p> : null}
        {!loadingMessages && messages.length === 0 ? (
          <p className="athlete-chat__empty-hint text-muted">
            Напиши вопрос — например: как дела с планом на этой неделе?
          </p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={bubbleClassName(message.role)}>
            {message.content}
          </div>
        ))}
        {sending ? (
          <div className="athlete-chat__bubble athlete-chat__bubble--assistant athlete-chat__typing">
            Думаю…
          </div>
        ) : null}
      </div>
      <form
        className="athlete-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={inputRef}
          className="athlete-chat__input"
          rows={2}
          value={draft}
          maxLength={AI_CHAT_MAX_MESSAGE_LENGTH}
          placeholder="Спроси про тренировки…"
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="athlete-chat__send" disabled={sending || !draft.trim()}>
          Отправить
        </button>
      </form>
    </div>
  );
}
