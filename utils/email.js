import nodemailer from "nodemailer";

export const sendAdminInviteEmail = async (toEmail, name, tempPassword, roleName) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: `"Shrimpbite Admin" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: "Welcome to Shrimpbite Admin Panel",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Welcome, ${name}!</h2>
                    <p>You have been invited to the Shrimpbite Admin Panel as a <strong>${roleName}</strong>.</p>
                    <p>Your temporary password is: <span style="font-weight: bold; background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</span></p>
                    <p>You can log in at: <a href="https://shrimpbite.in/admin" style="color: #4CAF50;">https://shrimpbite.in/admin</a> (or your temporary admin link).</p>
                    <p>When you log in for the first time, you will be strongly encouraged to change your password.</p>
                    <br/>
                    <p>Thanks,</p>
                    <p>The Shrimpbite Team</p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};
