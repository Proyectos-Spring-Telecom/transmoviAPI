import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginAuthDto{
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({
                description: 'Usuario',
                example: 'ejemplo@ejemplo.com',
            })
    UserName:string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
            description: 'Contraseña',
            example: 'contraseña1',
        })
    Password: string;

}