import { createCanvas, loadImage } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import { join } from 'path';
import fs from 'fs';

export async function generateStyledQR(qrData: string, role: string = 'student', filepath: string): Promise<void> {
    const qrSize = 400;
    const borderPadding = 20;
    const totalSize = qrSize + borderPadding * 2;

    // 1. Generate QR Code image data URL with high error correction (H)
    const qrDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: qrSize,
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    });

    const canvas = createCanvas(totalSize, totalSize);
    const ctx = canvas.getContext('2d');

    // 2. Determine border color based on role
    const normalizedRole = (role || 'student').toLowerCase();
    let borderColor = '#16a34a'; // default green (Student)
    if (normalizedRole === 'employee' || normalizedRole === 'staff') {
        borderColor = '#ffffff'; // White
    } else if (normalizedRole === 'visitor') {
        borderColor = '#2563eb'; // Blue
    } else if (normalizedRole === 'concessionaire') {
        borderColor = '#eab308'; // Yellow
    } else if (normalizedRole === 'guest') {
        borderColor = '#6b7280'; // Gray
    }

    // Fill background with border color
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, totalSize, totalSize);

    // If white border, draw a subtle dark border around outer edge for visibility on white bg
    if (borderColor === '#ffffff') {
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, totalSize - 4, totalSize - 4);
    }

    // 3. Draw QR image inside the border
    const qrImage = await loadImage(qrDataUrl);
    ctx.drawImage(qrImage, borderPadding, borderPadding, qrSize, qrSize);

    // 4. Overlay Liceo logo in center (transparent background, no white box)
    const logoPath = join(process.cwd(), 'static', 'liceo-logo.png');
    if (fs.existsSync(logoPath)) {
        const logo = await loadImage(logoPath);
        const logoDrawSize = 90;
        const centerX = totalSize / 2;
        const centerY = totalSize / 2;
        const logoX = centerX - logoDrawSize / 2;
        const logoY = centerY - logoDrawSize / 2;
        ctx.drawImage(logo, logoX, logoY, logoDrawSize, logoDrawSize);
    }

    // 5. Write canvas to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
}
