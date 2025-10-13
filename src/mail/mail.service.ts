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
        pass: 'p323+p2%16#^',
      },
    });
  }

  async sendConfirmationEmail(to: string, name: string, token: string) {
    const url = `http://localhost:3000/login/verify?token=${token}`;
    await this.transporter.sendMail({
      from: `<${process.env.E_MAIL}>`,
      to,
      subject: '¡Bienvenido!',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body style="font-family: 'Open Sans', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table width="550px" style="background-color: #FFFFFF; border-radius: 13px; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;" cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td  style="background-color: #002136; color: #FFFFFF; padding: 1rem; ">
                            <a href="#">
                                <img src="https://transmovi.s3.us-east-2.amazonaws.com/logos/transmovi.png" alt="logo" style="height: 95px;">
                            </a>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td  style="padding: 0 2rem; "  align="center">
                            <h5 style="color: #002136; font-size: 30px; text-align:center">
                                ¡Bienvenido!
                            </h5>
                            <p style="color: #002136; font-family: 'Open Sans', sans-serif; font-size: 16px; text-align: center; margin-top: -30px;">${name} nos alegra que estés aquí, te damos la bienvenida a Transmovi. <strong>Por favor, confirma tu correo electrónico haciendo click en el siguiente botón.</strong></p>
                            <a href=${url} style="font-size: 18px; padding: 0.9rem; background-color: #43cc7a; color: #FFFFFF; border-radius: 30px; text-decoration: none; display: inline-block; margin-top: 13px; ">Confirmar correo electrónico</a>
                        </td>
                    </tr>
                    <!-- Divider -->
                    <tr><td  style="padding: 0 2rem; "><hr style="border: none; height: 2px; background-color: rgba(226, 226, 226, 0.589); margin-top: 25px;"></td></tr>
                    <tr>
                        <td  style="padding: 0 2rem; "><br>
                            <p style="margin: 0; font-size: 16px; font-family: 'Open Sans', sans-serif;"><strong>Nota: </strong>Este correo fue enviado desde una dirección de notificaciones, por favor no respondas a este mensaje, es solo de ENVÍO. Si tampoco reconoces está acción puedes ignorar este correo electrónico.</p>
                            <p >Atentamente,</p>
                            <p style="margin-top: -10px;"><strong>Transmovi</strong></p>
                        <br>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #002136; color: #FFFFFF; padding: 2rem; " align="center">
                            <!-- Contenido del footer aquí -->                  
                            <h5 style="color: #FFFFFF; margin: 0; font-family: 'Open Sans', sans-serif; font-size: 13px;"><b>Gracias
                                por registrarte con nosotros.</b></h5><br>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Si necesita ayuda o tiene
                                preguntas, siempre nos complace poder ayudarle. Comuníquese con nosotros enviándonos un correo
                                electrónico a contacto@transmovi.mx</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Atentamente,</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">© Transmovi</p>
                            <br>
                            <p style="margin: 0; font-size: 9px; font-family: 'Open Sans', sans-serif;">Transmovi, Av. Independencia Manzana #016, Col. Centro, 50000 Toluca de Lerdo, México. 
                                RFC:QSY240515579</p>
                            <!-- Redes sociales y más -->
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `,
    });
  }

  async sendResetPasswordEmail(to: string,name: string, token: string) {
    const url = `http://localhost:3000/reset-password?token=${token}`;
    // 👆 Este debe apuntar a tu frontend Angular (puedes ajustarlo a localhost:3000 si haces la prueba desde backend)

    await this.transporter.sendMail({
      from: ` <${process.env.E_MAIL}>`,
      to,
      subject: 'Restablecer Contraseña',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body style="font-family: 'Open Sans', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table width="550px" style="background-color: #FFFFFF; border-radius: 13px; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;" cellpadding="0" cellspacing="0">
                    <!-- Header -->
                    <tr>
                        <td  style="background-color: #002136; color: #FFFFFF; padding: 1rem; ">
                            <a href="#">
                                <img src="https://transmovi.s3.us-east-2.amazonaws.com/logos/transmovi.png" alt="logo" style="height: 95px;">
                            </a>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td  style="padding: 0 2rem; "  align="center">
                            <h5 style="color: #002136; font-size: 30px; text-align:center">
                                Restablecer Contraseña
                            </h5>
                            <p style="color: #002136; font-family: 'Open Sans', sans-serif; font-size: 16px; text-align: center; margin-top: -30px;">Hola, haz click en el siguiente botón para restablecer tu contraseña. Si no has solicitado una nueva contraseña, <strong>ignora este correo</strong>.</p>
                            <a href= ${url} style="font-size: 18px; padding: 0.9rem; background-color: #43cc7a; color: #FFFFFF; border-radius: 30px; text-decoration: none; display: inline-block; margin-top: 13px; ">Restablecer Contraseña</a>
                        </td>
                    </tr>
                    <!-- Divider -->
                    <tr><td  style="padding: 0 2rem; "><hr style="border: none; height: 2px; background-color: rgba(226, 226, 226, 0.589); margin-top: 25px;"></td></tr>
                    <tr>
                        <td  style="padding: 0 2rem; "><br>
                            <p style="margin: 0; font-size: 16px; font-family: 'Open Sans', sans-serif;"><strong>Nota: </strong>Recibes este correo electrónico porque has solicitado restablecer tu contraseña. Si no estas seguro/a de por qué estás recibiendo esto ignoralo.</p>
                            <p >Atentamente,</p>
                            <p style="margin-top: -10px;"><strong>Transmovi</strong></p>
                        <br>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #002136; color: #FFFFFF; padding: 2rem; " align="center">
                            <!-- Contenido del footer aquí -->                  
                            <h5 style="color: #FFFFFF; margin: 0; font-family: 'Open Sans', sans-serif; font-size: 13px;"><b>Gracias
                                por ser parte de nosotros.</b></h5><br>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Si necesita ayuda o tiene
                                preguntas, siempre nos complace poder ayudarle. Comuníquese con nosotros enviándonos un correo
                                electrónico a contacto@transmovi.mx</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">Atentamente,</p>
                            <p style="margin: 0; font-size: 13px; font-family: 'Open Sans', sans-serif;">© Transmovi</p>
                            <br>
                            <p style="margin: 0; font-size: 9px; font-family: 'Open Sans', sans-serif;">Transmovi, Av. Independencia Manzana #016, Col. Centro, 50000 Toluca de Lerdo, México. 
                                RFC:QSY240515579</p>
                            <!-- Redes sociales y más -->
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `,
    });
  }
}
