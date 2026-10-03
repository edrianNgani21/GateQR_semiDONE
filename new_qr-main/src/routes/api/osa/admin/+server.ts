import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

async function createNotification(
    userId: number,
    notificationType: string,
    message: string,
    actorId?: number,
    actionType?: string,
    targetEntityType?: string,
    targetEntityId?: number,
    referenceId?: number,
    metadata?: any
) {
    try {
        await supabase.from('notifications').insert({
            user_id: userId,
            notification_type: notificationType,
            message: message,
            actor_id: actorId || null,
            action_type: actionType || null,
            target_entity_type: targetEntityType || null,
            target_entity_id: targetEntityId || null,
            reference_id: referenceId || null,
            metadata: metadata || null,
            is_read: false
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { email, user_type, identification } = await request.json();

        if (!email || !user_type || !identification) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('user')
            .select('email')
            .eq('email', email)
            .single();

        if (existingUser) {
            return json({ error: 'User with this email already exists' }, { status: 400 });
        }

        // Create new admin user
        const { data: newUser, error: createError } = await supabase
            .from('user')
            .insert({
                email,
                user_type,
                identification,
                is_active: true
            })
            .select('user_id, email, user_type')
            .single();

        if (createError) throw createError;

        // Create notification for the new admin
        if (newUser) {
            const actorId = locals.user?.user_id;
            await createNotification(
                newUser.user_id,
                'admin_created',
                'Admin added successfully!',
                actorId,
                'create_admin',
                'user',
                newUser.user_id,
                newUser.user_id,
                { user_type }
            );
        }

        return json({ 
            message: 'Admin created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        return json({ error: 'Failed to create admin' }, { status: 500 });
    }
};

export const GET: RequestHandler = async () => {
    try {
        const { data: users, error } = await supabase
            .from('user')
            .select('user_id, email, user_type, identification, is_active, created_at')
            .in('user_type', ['Osa', 'Safety Security', 'dean'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        return json({ users: users || [] });
    } catch (error) {
        console.error('Error fetching admins:', error);
        return json({ error: 'Failed to fetch admins' }, { status: 500 });
    }
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
    try {
        const { user_id, is_active } = await request.json();

        if (!user_id || typeof is_active !== 'boolean') {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: updatedUser, error } = await supabase
            .from('user')
            .update({ is_active })
            .eq('user_id', user_id)
            .select('user_id, email, user_type, is_active')
            .single();

        if (error) throw error;

        // Create notification for the admin whose status was changed
        if (updatedUser) {
            const actorId = locals.user?.user_id;
            await createNotification(
                updatedUser.user_id,
                is_active ? 'admin_activated' : 'admin_deactivated',
                is_active ? 'Admin activated successfully!' : 'Admin deactivated successfully!',
                actorId,
                is_active ? 'activate_admin' : 'deactivate_admin',
                'user',
                updatedUser.user_id,
                updatedUser.user_id,
                { user_type: updatedUser.user_type }
            );
        }

        return json({
            message: is_active ? 'Account activated successfully' : 'Account deactivated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating admin status:', error);
        return json({ error: 'Failed to update admin status' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
    try {
        const { user_id } = await request.json();

        if (!user_id) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get user info before deletion for notification
        const { data: userToDelete } = await supabase
            .from('user')
            .select('user_id, email, user_type')
            .eq('user_id', user_id)
            .single();

        const { error } = await supabase
            .from('user')
            .delete()
            .eq('user_id', user_id);

        if (error) throw error;

        // Create notification for the deleted admin (if we had their info)
        if (userToDelete) {
            const actorId = locals.user?.user_id;
            await createNotification(
                userToDelete.user_id,
                'admin_deleted',
                'Admin deleted successfully!',
                actorId,
                'delete_admin',
                'user',
                userToDelete.user_id,
                userToDelete.user_id,
                { user_type: userToDelete.user_type }
            );
        }

        return json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        return json({ error: 'Failed to delete admin' }, { status: 500 });
    }
};