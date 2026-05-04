import { supabase } from "@/integrations/supabase/client";

export const STORAGE_QUOTA_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

export async function getUsedBytes(): Promise<number> {
  const { data, error } = await (supabase.rpc as any)("get_my_storage_usage");
  if (error || data == null) return 0;
  return Number(data) || 0;
}

export async function ensureCanUpload(extraBytes: number): Promise<{ ok: true } | { ok: false; used: number; limit: number }> {
  const used = await getUsedBytes();
  if (used + extraBytes > STORAGE_QUOTA_BYTES) {
    return { ok: false, used, limit: STORAGE_QUOTA_BYTES };
  }
  return { ok: true };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
