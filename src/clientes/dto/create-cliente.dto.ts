import { IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class CreateClienteDto {
    @IsNotEmpty({message: 'Id necesario'})
    @MaxLength(50,{message: 'El campo IdPadre no puede exceder los 50 caracteres'})
    IdPadre: string;

    @IsNotEmpty({message: 'Es necesario el rfc'})
    @MaxLength(16,{message: 'El RFC debe tener entre 12 y 16 caracteres'})
    @MinLength(12,{message: 'El RFC debe tener entre 12 y 16 caracteres'})
    RFC: string;

    @IsNotEmpty({message: 'Tipo de persona necesario'})
    @IsInt({message: 'Tipo de persona debe ser un numero entero'})
    TipoPersona: number;

    @IsNotEmpty({message: 'Estaus necesario'})
    @IsInt({message: 'Estatus debe ser un numero entero'})
    @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
    Estatus: number;

    @IsOptional()
    @IsUrl({require_protocol: false})
    Logotipo?: string;

    @IsOptional()
    @MaxLength(255,{message: 'El Nombre no puede tener más de 255 caracteres'})
    Nombre?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El ApellidoPaterno no puede tener más de 100 caracteres'})
    ApellidoPaterno?: string;

    @IsOptional()
    @MaxLength(100,{message:'El ApellidoMaterno no puede tener más de 100 caracteres'})
    ApellidoMaterno?: string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, { message: 'Teléfono inválido' })
    Telefono?:string;

    @IsOptional()
    @IsEmail()
    @MaxLength(100,{message: 'El correo no puede tener más de 100 caracteres'})
    Correo?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Estado no puede tener más de 45 caracteres'})
    Estado?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Municipio no puede tener más de 45 caracteres'})
    Municipio?: string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Colonia no puede tener más de 45 caracteres'})
    Colonia?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El campo Calle no puede tener más de 100 caracteres'})
    Calle?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo EntreCalles no puede tener más de 45 caracteres'})
    EntreCalles?:string;

    @IsOptional()
    @MaxLength(10,{message: 'El campo NumeroExterior no puede tener más de 10 caracteres'})
    NumeroExterior?:string;

    @IsOptional()
    @MaxLength(10,{message: 'El campo NumeroInterior no puede tener más de 10 caracteres'})
    NumeroInterior?:string;

    @IsOptional()
    @Matches(/^[0-9]{5}$/, { message: 'El código postal no puede tener más de 5 dígitos' })
    CP?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El campo NombreEncargado no puede tener más de 100 caracteres'})
    NombreEncargado?:string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, { message: 'Teléfono inválido' })
    TelefonoEncargado?:string;

    @IsOptional()
    @IsEmail()
    @MaxLength(100,{message: 'El correo no puede tener más de 100 caracteres'})
    EmailEncargado?:string;
}
