import { createAdminClient } from './supabase-admin.ts';

export interface MemberDietProfile {
  diet_type: string;
  is_jain: boolean;
  allergies: string[];
}

// Diet profiles for every member of a flat — used by both create_poll (main
// dish selection) and close_poll (accompaniment selection) to compute the
// same dietary-veto union.
export async function fetchMemberDietProfiles(
  admin: ReturnType<typeof createAdminClient>,
  flatId: string
): Promise<MemberDietProfile[]> {
  const { data: memberRows, error } = await admin
    .from('flat_members')
    .select('profiles(diet_type, is_jain, allergies)')
    .eq('flat_id', flatId);
  if (error) throw error;

  return (memberRows ?? [])
    .map((row) => row.profiles)
    .filter((p): p is NonNullable<typeof p> => p !== null);
}
