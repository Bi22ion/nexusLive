export type PkSession = {
  id: string;
  status: "active" | "paused" | "ended";
  starts_at: string;
  duration_seconds: number;
  paused_reason: string | null;
  host_a_id: string;
  host_b_id: string;
  score_a: number;
  score_b: number;
};

export type PkHeartbeat = {
  session_id: string;
  host_id: string;
  last_seen_at: string;
};

