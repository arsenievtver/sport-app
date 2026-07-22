import { useEffect, useRef, useState } from "react";
import {
  createAthleteAiChatThread,
  fetchAthleteAiChatMessages,
  humanizeFetchError,
  sendAthleteAiChatMessage,
} from "@sport-app/api-client";
import { AI_CHAT_MAX_MESSAGE_LENGTH, type AthleteAiChatMessage } from "@sport-app/shared";
import "./athlete-chat.css";

function bubbleClassName(role: string): string {
  if (role === "user") {
    return "athlete-chat__bubble athlete-chat__bubble--user";
  }
  return "athlete-chat__bubble athlete-chat__bubble--assistant";
}

export function AthleteChatPanel() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AthleteAiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);
      try {
        const thread = await createAthleteAiChatThread({});
        if (cancelled) return;
        setThreadId(thread.id);
        setMessages([]);
        window.setTimeout(() => inputRef.current?.focus(), 50);
      } catch (err) {
        if (!cancelled) setError(humanizeFetchError(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !threadId || sending) return;
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
      const result = await sendAthleteAiChatMessage(threadId, { content });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        result.user_message,
        result.assistant_message,
      ]);
    } catch (err) {
      setDraft(content);
      setError(humanizeFetchError(err));
      try {
        const list = await fetchAthleteAiChatMessages(threadId);
        setMessages(list);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    } finally {
      setSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="athlete-overlay-screen athlete-chat athlete-chat--conversation">
      <p className="athlete-chat__hint text-muted">
        Спроси про план, тренировки, вес, питание или WHOOP
      </p>
      {error ? <p className="athlete-chat__error">{error}</p> : null}
      <div className="athlete-chat__messages" ref={listRef}>
        {booting ? <p className="text-muted">Готовлю чат…</p> : null}
        {!booting && messages.length === 0 ? (
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
          disabled={sending || booting || !threadId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="athlete-chat__send"
          disabled={sending || booting || !threadId || !draft.trim()}
        >
          Отправить
        </button>
      </form>
    </div>
  );
}
