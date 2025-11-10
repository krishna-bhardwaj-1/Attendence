const nodemailer = require('nodemailer');

// In-memory OTP storage (can be moved to Redis/database for production)
const otpStore = new Map();

// Email transporter configuration
// FIXED: Removed duplicate @ symbol
const emailUser = 'krishna.bhardwaj_cs23@gla.ac.in';
const emailPass = 'klhn oegi twmg uqbf';

// Check if email credentials are configured
if (!emailUser || !emailPass) {
    console.warn('[OTP] ⚠️ Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS in .env file');
    console.warn('[OTP] For Gmail: Use App Password (not regular password)');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    }
});

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize email address - remove double @ symbols and clean up
function normalizeEmail(email) {
    if (!email) return email;
    
    // Remove any double @ symbols
    let normalized = email.replace(/@@+/g, '@');
    
    // Remove any leading/trailing whitespace
    normalized = normalized.trim();
    
    // Basic validation - should have exactly one @
    const atCount = (normalized.match(/@/g) || []).length;
    if (atCount !== 1) {
        if (atCount === 0 && normalized.includes('_')) {
            const parts = normalized.split('_');
            if (parts.length > 1) {
                const lastPart = parts[parts.length - 1];
                if (lastPart.includes('.')) {
                    normalized = parts.slice(0, -1).join('_') + '@' + lastPart;
                }
            }
        } else if (atCount > 1) {
            const firstAt = normalized.indexOf('@');
            normalized = normalized.substring(0, firstAt + 1) + normalized.substring(firstAt + 1).replace(/@/g, '');
        }
    }
    
    return normalized;
}

// Send OTP to email
async function sendOTP(email, teacherName) {
    try {
        // Normalize email address first
        const normalizedEmail = normalizeEmail(email);
        
        if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.split('@').length !== 2) {
            return {
                success: false,
                message: `Invalid email address format: ${email}. Please contact administrator to update your email.`
            };
        }
        
        // Check if email credentials are configured
        if (!emailUser || !emailPass || emailUser === 'your-email@gmail.com' || emailPass === 'your-app-password') {
            console.error('[OTP] Email credentials not configured');
            return { 
                success: false, 
                message: 'Email service not configured. Please contact administrator or check OTP_SETUP.md for setup instructions.' 
            };
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

        // Store OTP with expiry (use normalized email as key)
        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            attempts: 0
        });

        // Email content
        const mailOptions = {
            from: emailUser,
            to: normalizedEmail,
            subject: 'Smart Attendance - OTP Verification',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #00d4aa 0%, #0ea5e9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .otp-box { background: #fff; border: 2px solid #00d4aa; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #00d4aa; letter-spacing: 5px; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Smart Attendance</h1>
                            <p>OTP Verification</p>
                        </div>
                        <div class="content">
                            <p>Hello ${teacherName},</p>
                            <p>You have requested to access your Educator Portal. Please use the following OTP to verify your identity:</p>
                            <div class="otp-box">
                                <div class="otp-code">${otp}</div>
                            </div>
                            <p><strong>This OTP will expire in 10 minutes.</strong></p>
                            <p>If you didn't request this OTP, please ignore this email.</p>
                            <div class="footer">
                                <p>This is an automated email. Please do not reply.</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
        console.error('[OTP] Error sending email:', error.message);
        
        let errorMessage = 'Failed to send OTP. Please try again.';
        
        if (error.code === 'EAUTH') {
            errorMessage = 'Email authentication failed. Please check EMAIL_USER and EMAIL_PASS in .env file. For Gmail, use App Password (not regular password).';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Could not connect to email server. Please check your internet connection.';
        } else if (error.responseCode === 535 || error.code === 535) {
            errorMessage = 'Email credentials invalid. Please verify EMAIL_USER and EMAIL_PASS in .env file. For Gmail, ensure you\'re using an App Password.';
        } else if (error.message) {
            errorMessage = `Failed to send OTP: ${error.message}`;
        }
        
        return { success: false, message: errorMessage };
    }
}

// Verify OTP
function verifyOTP(email, otp) {
    // Normalize email before verification
    const normalizedEmail = normalizeEmail(email);
    const stored = otpStore.get(normalizedEmail);
    
    if (!stored) {
        return { success: false, message: 'OTP not found. Please request a new OTP.' };
    }

    // Check expiry
    if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedEmail);
        return { success: false, message: 'OTP has expired. Please request a new OTP.' };
    }

    // Check attempts (max 5 attempts)
    if (stored.attempts >= 5) {
        otpStore.delete(normalizedEmail);
        return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
    }

    // Verify OTP
    if (stored.otp !== otp) {
        stored.attempts++;
        return { success: false, message: 'Invalid OTP. Please try again.' };
    }

    // OTP verified successfully - remove from store
    otpStore.delete(normalizedEmail);
    return { success: true, message: 'OTP verified successfully' };
}

// Clean up expired OTPs (run periodically)
function cleanupExpiredOTPs() {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(email);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
    sendOTP,
    verifyOTP
};