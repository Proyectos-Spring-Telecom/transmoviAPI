// src/email/email.service.ts

import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
  

 constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.HOST, // o tu proveedor SMTP
      port: process.env.SMTP,
      secure: true,
      auth: {
        user: process.env.E_MAIL,
        pass: "p323+p2%16#^",
      },
    });
  }

  async sendConfirmationEmail(to: string, token: string) {
    const url = `https://tudominioss.com/confirmar?token=${token}`;
    await this.transporter.sendMail({
      from: `"Mi App" <${process.env.E_MAIL}>`,
      to,
      subject: 'Confirma tu cuenta',
      html: `
        <!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Transmovi</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #fff;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .logo {
      width: 150px;
      margin-bottom: 20px;
    }
    h1 {
      color: #2E8BFF;
    }
    p {
      font-size: 16px;
      line-height: 1.5;
    }
    .button {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 25px;
      font-size: 16px;
      color: #fff;
      background-color: #2E8BFF;
      text-decoration: none;
      border-radius: 5px;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://transmovi.s3.us-east-2.amazonaws.com/usuarios/fb4c24f2-d748-4206-9e15-8c20d6dc1936.jpeg" alt="Transmovi" class="logo">
    <h1>¡Bienvenido, ${to}!</h1>
    <p>
      Gracias por registrarte en <strong>Transmovi</strong>. 
      Para activar tu cuenta, por favor confirma tu correo haciendo clic en el botón a continuación.
    </p>
    <a href="${url}" class="button">Confirmar mi cuenta</a>
    <p class="footer">
      Si no creaste esta cuenta, ignora este correo.
    </p>
  </div>
</body>
</html>
      `,
    });
  }
}
