import { IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class CreateClienteDto {
    @IsNotEmpty({message: 'Id necesario'})
    @MaxLength(50,{message: 'El campo IdPadre no puede exceder los 50 caracteres'})
    idPadre: string;

    @IsNotEmpty({message: 'Es necesario el rfc'})
    @MaxLength(16,{message: 'El RFC debe tener entre 12 y 16 caracteres'})
    @MinLength(12,{message: 'El RFC debe tener entre 12 y 16 caracteres'})
    rfc: string;

    @IsNotEmpty({message: 'Tipo de persona necesario'})
    @IsInt({message: 'Tipo de persona debe ser un numero entero'})
    tipoPersona: number;

    @IsNotEmpty({message: 'Estaus necesario'})
    @IsInt({message: 'Estatus debe ser un numero entero'})
    @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
    estatus: number;

    @IsOptional()
    @IsUrl({require_protocol: false})
    logotipo: string;

    @IsNotEmpty({message: 'Es necesario el nombre'})
    @MaxLength(255,{message: 'El Nombre no puede tener más de 255 caracteres'})
    nombre:string;

    @IsNotEmpty({message: 'Es necesario Apellido Paterno'})
    @MaxLength(100,{message: 'El ApellidoPaterno no puede tener más de 100 caracteres'})
    apellidoPaterno: string;

    @IsOptional()
    @MaxLength(100,{message:'El ApellidoMaterno no puede tener más de 100 caracteres'})
    apellidoMaterno?: string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, { message: 'Teléfono inválido' })
    telefono?:string;

    @IsOptional()
    @IsEmail()
    @MaxLength(100,{message: 'El correo no puede tener más de 100 caracteres'})
    correo?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Estado no puede tener más de 45 caracteres'})
    estado?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Municipio no puede tener más de 45 caracteres'})
    municipio?: string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Colonia no puede tener más de 45 caracteres'})
    colonia?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El campo Calle no puede tener más de 100 caracteres'})
    calle?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo EntreCalles no puede tener más de 45 caracteres'})
    entreCalles?:string;

    @IsOptional()
    @MaxLength(10,{message: 'El campo NumeroExterior no puede tener más de 10 caracteres'})
    numeroExterior?:string;

    @IsOptional()
    @MaxLength(10,{message: 'El campo NumeroInterior no puede tener más de 10 caracteres'})
    numeroInterior?:string;

    @IsOptional()
    @Matches(/^[0-9]{5}$/, { message: 'El código postal no puede tener más de 5 dígitos' })
    cp?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El campo NombreEncargado no puede tener más de 100 caracteres'})
    nombreEncargado?:string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, { message: 'Teléfono inválido' })
    telefonoEncargado?:string;

    @IsOptional()
    @IsEmail()
    @MaxLength(100,{message: 'El correo no puede tener más de 100 caracteres'})
    emailEncargado?:string;
}
