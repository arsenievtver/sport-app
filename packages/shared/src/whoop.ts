export interface WhoopConnectResponse {
  authorization_url: string;
}

export interface WhoopStatusResponse {
  connected: boolean;
  provider: string;
  external_user_id?: string | null;
  connected_at?: string | null;
  last_sync_at?: string | null;
  last_sync_error?: string | null;
  has_refresh_token?: boolean;
  last_sync?: WhoopSyncPayload | null;
}

export interface WhoopRecoveryRecord {
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
  };
  created_at?: string;
}

export interface WhoopSleepRecord {
  start?: string;
  end?: string;
  score?: {
    sleep_performance_percentage?: number;
    sleep_efficiency_percentage?: number;
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
  };
}

export interface WhoopWorkoutRecord {
  sport_name?: string;
  start?: string;
  end?: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
  };
}

export interface WhoopCycleRecord {
  start?: string;
  end?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
}

export interface WhoopSyncPayload {
  synced_at?: string;
  profile?: { first_name?: string; last_name?: string; email?: string };
  recovery?: { records?: WhoopRecoveryRecord[] };
  sleep?: { records?: WhoopSleepRecord[] };
  workouts?: { records?: WhoopWorkoutRecord[] };
  cycles?: { records?: WhoopCycleRecord[] };
}

export interface WhoopSyncResponse extends WhoopSyncPayload {
  synced_at: string;
  profile: Record<string, unknown>;
  body_measurement: Record<string, unknown>;
  recovery: Record<string, unknown>;
  sleep: Record<string, unknown>;
  workouts: Record<string, unknown>;
  cycles: Record<string, unknown>;
}
