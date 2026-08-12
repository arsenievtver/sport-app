export interface PushSubscriptionKeysPayload {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionCreatePayload {
  endpoint: string;
  keys: PushSubscriptionKeysPayload;
  user_agent?: string | null;
}

export interface PushSubscriptionStatus {
  enabled: boolean;
}

export interface VapidPublicKeyResponse {
  public_key: string;
}
