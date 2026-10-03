import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function checkAuth(request: Request): boolean {
    return request.headers.get('X-Gate-Key') === env.PRIVATE_GATE_API_KEY;
}

export const POST: RequestHandler = async ({ request }) => {
    if (!checkAuth(request)) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { registration_id, pic_base64, logged_status } = await request.json();

        if (!registration_id) {
            return json({ error: 'Missing registration_id' }, { status: 400 });
        }

        // Get vehicle_information_id from registration
        const { data: regData } = await supabase
            .from('registration')
            .select('vehicle_information_id')
            .eq('registration_id', registration_id)
            .single();

        if (!regData) {
            return json({ error: 'Registration not found' }, { status: 404 });
        }

        const vehicle_information_id = regData.vehicle_information_id;

        let picUrl = null;
        if (pic_base64) {
            try {
                const uploadDir = path.join(process.cwd(), 'static', 'uploads', 'gate');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const base64Data = pic_base64.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                
                const filename = `out_${registration_id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
                const filepath = path.join(uploadDir, filename);
                
                fs.writeFileSync(filepath, buffer);
                picUrl = `/uploads/gate/${filename}`;
            } catch (err) {
                console.error('[Gate] Error saving exit image:', err);
            }
        }

        // Find the most recent open entrylog for this registration
        const { data: rows, error: queryError } = await supabase
            .from('vehicle_log')
            .select('vehicle_log_id')
            .eq('registration_id', registration_id)
            .is('check_out', null)
            .order('check_in', { ascending: false })
            .limit(1)
            .single();

        if (rows && !queryError) {
            // Update existing open entry log with OUT time, photo, and OUT-time status
            const { error: updateError } = await supabase
                .from('vehicle_log')
                .update({
                    check_out: new Date().toISOString(),
                    pic_out: picUrl,
                    logged_status_out: logged_status || null
                })
                .eq('vehicle_log_id', rows.vehicle_log_id);

            if (updateError) throw updateError;

            // Update parking availability record - decrement occupied, increment unoccupied
            const vehicle_log_id = rows.vehicle_log_id;

            // Get current parking capacity settings
            const { data: settingsData } = await supabase
                .from('parking_availability')
                .select('parking_capacity')
                .order('date_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            const parking_capacity = settingsData?.parking_capacity ?? 0;

            // Get current slot counts from the most recent parking availability record
            const { data: lastParkingData } = await supabase
                .from('parking_availability')
                .select('slot_occupied, slot_unoccupied')
                .order('date_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            const current_occupied = lastParkingData?.slot_occupied || 0;
            const current_unoccupied = lastParkingData?.slot_unoccupied || parking_capacity;

            // Calculate new slot counts
            const new_occupied = Math.max(0, current_occupied - 1);
            const new_unoccupied = Math.min(parking_capacity, current_unoccupied + 1);

            // Create new parking availability record
            const { error: parkingError } = await supabase
                .from('parking_availability')
                .insert({
                    vehicle_log_id,
                    parking_capacity,
                    slot_occupied: new_occupied,
                    slot_unoccupied: new_unoccupied,
                    date_time: new Date().toISOString()
                });

            if (parkingError) throw parkingError;
        } else {
            // No open entry log found — create a standalone OUT row
            const { error: insertError } = await supabase
                .from('vehicle_log')
                .insert({
                    registration_id,
                    vehicle_information_id,
                    check_out: new Date().toISOString(),
                    pic_out: picUrl,
                    logged_status_out: logged_status || null
                });

            if (insertError) throw insertError;
        }

        return json({ success: true, message: 'Exit recorded' });
    } catch (error) {
        console.error('[Gate] Exit error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
