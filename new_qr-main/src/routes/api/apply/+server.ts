import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();

        const role = formData.get('role') as string;
        const department_name = formData.get('department_name') as string;
        const id_no = formData.get('id_no') as string;
        const first_name = formData.get('first_name') as string;
        const last_name = formData.get('last_name') as string;
        const vehicle_make = formData.get('vehicle_make') as string;
        const vehicle_plate = formData.get('vehicle_plate') as string;
        const vehicle_color = formData.get('vehicle_color') as string || 'Not Specified';
        const vehicle_type = (formData.get('vehicle_type') as string) || '4-wheeler';
        const is_owner = formData.get('is_owner') as string;
        const contact_number = formData.get('contact_number') as string;
        const facebook = formData.get('facebook') as string;
        const campus = formData.get('campus') as string || 'Liceo Main';
        const year_level = formData.get('year_level') as string || null;

        const saveFile = async (fileKey: string) => {
            const file = formData.get(fileKey) as File | null;
            if (!file || file.size === 0) return null;
            const buffer = Buffer.from(await file.arrayBuffer());
            const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const filepath = join(process.cwd(), 'static', 'uploads', filename);
            writeFileSync(filepath, buffer);
            return `/uploads/${filename}`;
        };

        const doc_or = await saveFile('doc_or');
        const doc_cr = await saveFile('doc_cr');
        const doc_license = await saveFile('doc_license');
        const doc_id = await saveFile('doc_id');
        const doc_load = await saveFile('doc_load');
        const doc_letter = await saveFile('doc_letter');
        const doc_qr = null;

        // Extract vehicle brand from vehicle_make (use vehicle_color from form)
        const vehicle_brand = vehicle_make;

        // 1. Ensure user exists in user table
        let { data: users, error: userError } = await supabase
            .from('user')
            .select('user_id')
            .eq('email', locals.user.email)
            .single();

        let user_id = users?.user_id;

        if (!user_id || userError) {
            const { data: newUser, error: createError } = await supabase
                .from('user')
                .insert({ email: locals.user.email })
                .select('user_id')
                .single();

            if (createError) throw createError;
            user_id = newUser.user_id;

            // Send welcome email
            await sendEmail(
                locals.user.email,
                'Welcome to Liceo GateQR',
                'Welcome to Liceo GateQR! Your account has been successfully created.',
                '<h3>Welcome to Liceo GateQR!</h3><p>Your account has been successfully created.</p>'
            );
        }

        // 2. Resolve department_id (only active departments)
        let department_id = null;
        let dean_email = null;
        if (role !== 'visitor' && role !== 'concessionaire' && department_name) {
            const { data: depts, error: deptError } = await supabase
                .from('department')
                .select('department_id, email')
                .eq('department', department_name)
                .eq('is_active', true)
                .maybeSingle();

            if (deptError || !depts) {
                return json({ error: 'Department not found. Please select from the available departments or contact OSA to add your department.' }, { status: 400 });
            }

            department_id = depts.department_id;
            dean_email = depts.email;
        } else if (role === 'visitor' || role === 'concessionaire') {
            // For visitors and concessionaires, use a default department or handle accordingly
            // Since the database requires department_id, we'll need to handle this
            // For now, let's try to get the first active department as a fallback
            const { data: defaultDept } = await supabase
                .from('department')
                .select('department_id')
                .eq('is_active', true)
                .limit(1)
                .single();
            
            if (defaultDept) {
                department_id = defaultDept.department_id;
            }
        }

        // 3. Check if department is inactive (additional validation)
        if (department_id) {
            const { data: deptStatus } = await supabase
                .from('department')
                .select('is_active')
                .eq('department_id', department_id)
                .single();
            
            if (deptStatus && !deptStatus.is_active) {
                return json({ error: 'This department is currently inactive. Please contact OSA.' }, { status: 400 });
            }
        }

        // 4. Determine Initial Status based on Workflow
        // Changed: All applications now start with 'dept_val' so both dean and OSA can see them
        const status = 'dept_val';

        // 5. Insert into vehicle_information table first
        const { data: vehicleData, error: vehicleError } = await supabase
            .from('vehicle_information')
            .insert({
                or_document: doc_or || null,
                cr_document: doc_cr || null,
                plate_number: vehicle_plate,
                color: vehicle_color,
                brand: vehicle_brand,
                type: vehicle_type as any,
                qr_code: doc_qr || null,
                drivers_license: doc_license || null,
                school_id: doc_id || null,
                authorization_letter: doc_letter || '' // Use empty string instead of null to satisfy NOT NULL constraint
            })
            .select('vehicle_information_id')
            .single();

        if (vehicleError) throw vehicleError;

        const vehicle_information_id = vehicleData.vehicle_information_id;

        // 6. Insert into registration table
        const { error: insertError } = await supabase
            .from('registration')
            .insert({
                vehicle_information_id,
                status,
                user_id,
                department_id: department_id || 1, // Default to department_id 1 if not set
                agreement_form: null,
                first_name,
                last_name,
                mobile: contact_number,
                role,
                campus,
                year_level,
                facebook: facebook || null,
                student_id: id_no || null,
                enrollment_form: doc_load || null,
                is_owner: is_owner === 'yes'
            });

        if (insertError) throw insertError;
        
        console.log('Application submitted successfully with department_id:', department_id);

        // Send submission email to applicant
        await sendEmail(
            locals.user.email,
            'Application Submitted - Liceo GateQR',
            'Your vehicle sticker application has been successfully submitted and is now under review.',
            '<p>Your vehicle sticker application has been successfully submitted and is now under review.</p>'
        );

        // Send notification to dean if needed
        if (dean_email) {
            await sendEmail(
                dean_email,
                'New Application Received - Liceo GateQR',
                `You received a new vehicle sticker application from ${first_name} ${last_name}. Please log in to the portal to review it.`,
                `<p>You received a new vehicle sticker application from <strong>${first_name} ${last_name}</strong>.</p><p>Please log in to the portal to review it.</p>`
            );
        }

        // Send notification to OSA about new application
        await sendEmail(
            'osa@liceo.edu.ph',
            'New Application Submitted - Liceo GateQR',
            `A new vehicle sticker application has been submitted by ${first_name} ${last_name}. Please log in to the portal to review it.`,
            `<p>A new vehicle sticker application has been submitted by <strong>${first_name} ${last_name}</strong>.</p><p>Please log in to the portal to review it.</p>`
        );

        return json({ message: 'Application submitted successfully', status });
    } catch (error) {
        console.error('Failed to submit application:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
