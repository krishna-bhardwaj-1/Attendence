# OTP Email Setup Instructions

## Email Configuration

The teacher login system uses OTP (One-Time Password) verification via email. You need to configure email settings before using this feature.

### For Gmail Users:

1. **Enable 2-Step Verification:**
   - Go to your Google Account settings: https://myaccount.google.com/
   - Navigate to Security
   - Enable 2-Step Verification (if not already enabled)

2. **Generate App Password:**
   - Go to Google Account → Security → 2-Step Verification
   - Scroll down to "App passwords" (or visit: https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app and "Other" as the device
   - Enter "Smart Attendance" as the custom name
   - Click "Generate"
   - Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)
   - **Important:** Remove all spaces from the password

3. **Create .env file:**
   - Create a `.env` file in the project root (same directory as `app.js`)
   - Add the following (replace with your actual credentials):
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=abcdefghijklmnop
   ```
   - **Important:** 
     - Use your Gmail address for EMAIL_USER
     - Use the App Password (without spaces) for EMAIL_PASS
     - Do NOT use your regular Gmail password

### For Other Email Services:

Update the transporter configuration in `utils/otpService.js`:

```javascript
const transporter = nodemailer.createTransport({
    host: 'smtp.your-email-service.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
```

### Testing:

1. Make sure your `.env` file is configured
2. Restart your server
3. Try logging in as a teacher
4. Check your email for the OTP

### Troubleshooting:

- **"Failed to send OTP"**: Check your email credentials in `.env`
- **"Authentication failed"**: Make sure you're using an App Password (not your regular password) for Gmail
- **Email not received**: Check spam folder, verify email address in database

