import { supabaseAdmin } from './supabase';

const DEFAULT_BUCKET = 'gateqr-uploads';

/**
 * Uploads a file buffer/blob to Supabase Storage and returns its public URL.
 * 
 * @param path - Destination path/filename inside the bucket (e.g. 'documents/or-123.pdf', 'gate/in_123.jpg')
 * @param fileData - File content as Buffer, Uint8Array, or ArrayBuffer
 * @param contentType - MIME type (e.g. 'application/pdf', 'image/jpeg', 'image/png')
 * @param bucket - Bucket name (defaults to 'gateqr-uploads')
 * @returns The public URL of the uploaded file
 */
export async function uploadToStorage(
    path: string,
    fileData: Buffer | Uint8Array | ArrayBuffer,
    contentType?: string,
    bucket: string = DEFAULT_BUCKET
): Promise<string> {
    try {
        const cleanPath = path.replace(/^\/+/, '');
        const options: any = {
            upsert: true
        };
        if (contentType) {
            options.contentType = contentType;
        }

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(cleanPath, fileData, options);

        if (error) {
            console.error(`[Storage] Upload error for ${cleanPath}:`, error);
            throw error;
        }

        const { data: publicData } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(cleanPath);

        return publicData.publicUrl;
    } catch (err) {
        console.error(`[Storage] Failed to upload to Supabase storage (${path}):`, err);
        throw err;
    }
}

/**
 * Deletes a file from Supabase Storage by its public URL or relative path.
 * 
 * @param urlOrPath - The full public URL or relative path of the file
 * @param bucket - Bucket name (defaults to 'gateqr-uploads')
 */
export async function deleteFromStorage(
    urlOrPath: string,
    bucket: string = DEFAULT_BUCKET
): Promise<void> {
    try {
        if (!urlOrPath) return;

        let cleanPath = urlOrPath;
        if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
            const bucketMarker = `/${bucket}/`;
            const idx = urlOrPath.indexOf(bucketMarker);
            if (idx !== -1) {
                cleanPath = urlOrPath.substring(idx + bucketMarker.length);
            }
        }
        cleanPath = cleanPath.replace(/^\/+/, '');

        await supabaseAdmin.storage
            .from(bucket)
            .remove([cleanPath]);
    } catch (err) {
        console.error(`[Storage] Failed to delete file from storage (${urlOrPath}):`, err);
    }
}
