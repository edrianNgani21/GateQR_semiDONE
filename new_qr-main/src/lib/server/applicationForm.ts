import { supabase } from '$lib/server/supabase';

const KEY = 'application_form_open';

export interface FormStatusResult {
    open: boolean;
    updatedByEmail?: string | null;
    updatedAt?: string | null;
}

/** Returns whether applicants may currently access/submit the application form. Defaults to open. */
export async function isApplicationFormOpen(): Promise<boolean> {
    try {
        const status = await getApplicationFormStatus();
        return status.open;
    } catch {
        return true;
    }
}

/** Gets the detailed application form status including who updated it last. */
export async function getApplicationFormStatus(): Promise<FormStatusResult> {
    try {
        const { data, error } = await supabase
            .from('application_form_settings')
            .select('value, updated_at, updated_by_email')
            .eq('key', KEY)
            .maybeSingle();
        if (error || !data) return { open: true };
        return {
            open: data.value !== 'false',
            updatedByEmail: data.updated_by_email || null,
            updatedAt: data.updated_at || null
        };
    } catch {
        return { open: true };
    }
}

/** Opens or closes the application form, recording the user ID and email of the admin who performed the change. */
export async function setApplicationFormOpen(open: boolean, userId?: number, userEmail?: string): Promise<FormStatusResult> {
    const updatedAt = new Date().toISOString();
    const payload: Record<string, any> = {
        key: KEY,
        value: open ? 'true' : 'false',
        updated_at: updatedAt
    };
    if (userId !== undefined) payload.updated_by = userId;
    if (userEmail !== undefined) payload.updated_by_email = userEmail;

    const { error } = await supabase
        .from('application_form_settings')
        .upsert(payload, { onConflict: 'key' });
        
    if (error) throw error;

    return {
        open,
        updatedByEmail: userEmail || null,
        updatedAt
    };
}
