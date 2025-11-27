const nodemailer = require('nodemailer');
const otpStore = new Map();

const emailUser = 'krishna.bhardwaj_cs23@gla.ac.in';
const emailPass = 'jhhg zemz ihvo vfwl';

if (!emailUser || !emailPass) {
    console.warn('⚠️ Email credentials not configured');
} else {
    console.log('✅ Email credentials loaded');
    console.log('📧 Email User:', emailUser);
    console.log('🔑 Password length:', emailPass.length, 'characters');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPass
    }
});

transporter.verify(function(error, success) {
    if (error) {
        console.error('❌ SMTP Connection Failed:', error.message);
    } else {
        console.log('✅ SMTP Server is ready to send emails');
    }
});

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email) {
    if (!email) return email;
    let normalized = email.replace(/@@+/g, '@');
    normalized = normalized.trim();
    
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

async function sendOTP(email, teacherName) {
    try {
        const normalizedEmail = normalizeEmail(email);
        
        if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.split('@').length !== 2) {
            return {
                success: false,
                message: `Invalid email address format: ${email}. Please contact administrator to update your email.`
            };
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            attempts: 0
        });

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
        
        if (error.code === 'EAUTH' || error.responseCode === 535) {
            errorMessage = 'Gmail authentication failed. Please generate a new App Password from https://myaccount.google.com/apppasswords';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Could not connect to Gmail servers. Please check your internet connection.';
        } else if (error.message) {
            errorMessage = `Failed to send OTP: ${error.message}`;
        }
        
        return { success: false, message: errorMessage };
    }
}

function verifyOTP(email, otp) {
    const normalizedEmail = normalizeEmail(email);
    const stored = otpStore.get(normalizedEmail);
    
    if (!stored) {
        return { success: false, message: 'OTP not found. Please request a new OTP.' };
    }

    if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedEmail);
        return { success: false, message: 'OTP has expired. Please request a new OTP.' };
    }

    if (stored.attempts >= 5) {
        otpStore.delete(normalizedEmail);
        return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (stored.otp !== otp) {
        stored.attempts++;
        return { success: false, message: 'Invalid OTP. Please try again.' };
    }

    otpStore.delete(normalizedEmail);
    return { success: true, message: 'OTP verified successfully' };
}

function cleanupExpiredOTPs() {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(email);
        }
    }
}

setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
    sendOTP,
    verifyOTP
};