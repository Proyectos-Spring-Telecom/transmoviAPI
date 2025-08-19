import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginAuthDto{
    @IsEmail()
    @IsNotEmpty()
    UserName:string;

    @IsString()
    @IsNotEmpty()
    Password: string;

}