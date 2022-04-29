import nodemailer from 'nodemailer';
import config from 'config';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

const mailConfig: SMTPTransport = config.get('mail');

const transporter = nodemailer.createTransport(mailConfig);

export default transporter;
