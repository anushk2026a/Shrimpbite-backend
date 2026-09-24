import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendWelcomeEmail = async (email, name) => {
    const mailOptions = {
        from: `"ShrimpBite 🦐" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Welcome to ShrimpBite 🦐",
        html: `
      <div style="font-family: Arial; padding:20px;">
        <h2>Welcome to ShrimpBite, ${name}! 🦐</h2>
        
        <p>We're excited to have you join our seafood community.</p>
        
        <p>
          Discover fresh seafood, explore amazing retailers,
          and enjoy a smooth ordering experience.
        </p>

        <p>
          Start exploring the app and find the best seafood near you!
        </p>

        <br/>

        <p>Happy shopping! 🦐</p>
        <p><strong>The ShrimpBite Team</strong></p>
      </div>
    `
    };

    await transporter.sendMail(mailOptions);
};
export const sendAdminAlertEmail = async (emails, subject, htmlContent) => {
    if (!emails || emails.length === 0) return;
    try {
        const mailOptions = {
            from: `"ShrimpBite System 🦐" <${process.env.EMAIL_USER}>`,
            bcc: emails, // Use BCC so admins don't see each other's emails
            subject,
            html: htmlContent
        };
        await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Sent admin alert: ${subject}`);
    } catch (err) {
        console.error("[Email Service] Failed to send admin alert:", err.message);
    }
};
