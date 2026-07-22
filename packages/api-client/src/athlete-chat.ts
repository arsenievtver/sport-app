import type {
  AthleteAiChatMessage,
  AthleteAiChatMessageCreatePayload,
  AthleteAiChatSendResponse,
  AthleteAiChatThread,
  AthleteAiChatThreadCreatePayload,
} from "@sport-app/shared";

import { authenticatedFetchOk } from "./auth";

export async function fetchAthleteAiChatThreads(): Promise<AthleteAiChatThread[]> {
  const res = await authenticatedFetchOk("/athlete/chat/threads");
  return res.json() as Promise<AthleteAiChatThread[]>;
}

export async function createAthleteAiChatThread(
  payload: AthleteAiChatThreadCreatePayload = {},
): Promise<AthleteAiChatThread> {
  const res = await authenticatedFetchOk("/athlete/chat/threads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteAiChatThread>;
}

export async function fetchAthleteAiChatMessages(threadId: string): Promise<AthleteAiChatMessage[]> {
  const res = await authenticatedFetchOk(`/athlete/chat/threads/${threadId}/messages`);
  return res.json() as Promise<AthleteAiChatMessage[]>;
}

export async function sendAthleteAiChatMessage(
  threadId: string,
  payload: AthleteAiChatMessageCreatePayload,
): Promise<AthleteAiChatSendResponse> {
  const res = await authenticatedFetchOk(`/athlete/chat/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<AthleteAiChatSendResponse>;
}
