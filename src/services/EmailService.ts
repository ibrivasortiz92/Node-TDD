import transporter from '../utils/emailTransporter';
import nodemailer from 'nodemailer';
import logger from '../utils/logger';

const sendAccountActivation = async (email: string, token: string) => {
  const info = await transporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account Activation',
    html: `
    <div>
      <b>Please click below link to activate your account</b>
    </div>
    <div>
      <a href="http://localhost:8080/#login?token=${token}">Activate</a>
    </div>`,
  });
  logger.info('url: ' + (nodemailer.getTestMessageUrl(info) as string));
};

const sendPasswordReset = async (email: string, token: string) => {
  const info = await transporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Password Reset',
    html: `
    <div>
      <b>Please click below link to reset your password</b>
    </div>
    <div>
      <a href="http://localhost:8080/#/password-reset?reset=${token}">Reset</a>
    </div>`,
  });
  logger.info(`url: ${nodemailer.getTestMessageUrl(info) as string}`);
};

export default { sendAccountActivation, sendPasswordReset };
