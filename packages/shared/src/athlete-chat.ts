export const AI_CHAT_MAX_MESSAGE_LENGTH = 2000;

export interface AthleteAiChatThread {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AthleteAiChatMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
}

export interface AthleteAiChatSendResponse {
  user_message: AthleteAiChatMessage;
  assistant_message: AthleteAiChatMessage;
}

export interface AthleteAiChatThreadCreatePayload {
  title?: string | null;
}

export interface AthleteAiChatMessageCreatePayload {
  content: string;
}
