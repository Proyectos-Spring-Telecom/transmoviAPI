import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class CreateClienteDto {
    @IsNotEmpty({message: 'Id necesario'})
    @MaxLength(50,{message: 'El campo IdPadre no puede exceder los 50 caracteres'})
    @ApiProperty({
            description: 'Id del usuario que estara relacionado el cliente',
            example: '24',
        })
    IdPadre: string;

    @IsNotEmpty({message: 'Es necesario el rfc'})
    @MaxLength(16,{message: 'El RFC debe tener entre 12 y 16 caracteres'})
    @MinLength(12,{message: 'El RFC debe tener entre 12 y 16 caracteres'})
    @ApiProperty({
            description: 'El RFC del cliente',
            example: 'VECJ880326',
        })
    RFC: string;

    @IsNotEmpty({message: 'Tipo de persona necesario'})
    @IsInt({message: 'Tipo de persona debe ser un numero entero'})
    @ApiProperty({
            description: 'Que tipo de persona es',
            example: '2',
        })
    TipoPersona: number;

    @IsNotEmpty({message: 'Estaus necesario'})
    @IsInt({message: 'Estatus debe ser un numero entero'})
    @IsIn([0, 1], { message: 'Solo puede ser 0 ó 1' })
    @ApiProperty({
            description: 'El estatus es solo 0 ó 1',
            example: '1',
        })
    Estatus: number;

    @IsOptional()
    @IsUrl({require_protocol: false})
    @ApiProperty({
            description: 'la Url de la imagen',
            example: 'https://www.ejemplo.com/pagina',
        })
    Logotipo?: string;

    @IsOptional()
    @MaxLength(255,{message: 'El Nombre no puede tener más de 255 caracteres'})
    @ApiProperty({
            description: 'Nombre del cliente',
            example: 'Mauricio',
        })
    Nombre?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El ApellidoPaterno no puede tener más de 100 caracteres'})
    @ApiProperty({
            description: 'Apellido Paterno',
            example: 'Martinez',
        })
    ApellidoPaterno?: string;

    @IsOptional()
    @MaxLength(100,{message:'El ApellidoMaterno no puede tener más de 100 caracteres'})
    @ApiProperty({
            description: 'Apellido Materno',
            example: 'Castillo',
        })
    ApellidoMaterno?: string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, { message: 'Teléfono inválido' })
    @ApiProperty({
            description: 'Numero telefonico',
            example: '7354442211',
        })
    Telefono?:string;

    @IsOptional()
    @IsEmail()
    @MaxLength(100,{message: 'El correo no puede tener más de 100 caracteres'})
    @ApiProperty({
            description: 'Correo electronico',
            example: 'correo@ejemplo.com',
        })
    Correo?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Estado no puede tener más de 45 caracteres'})
    @ApiProperty({
            description: 'Nombre del entidad en donde reside',
            example: 'Guanajuato',
        })
    Estado?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Municipio no puede tener más de 45 caracteres'})
    @ApiProperty({
            description: 'Municipo donde reside',
            example: 'Celaya',
        })
    Municipio?: string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo Colonia no puede tener más de 45 caracteres'})
    @ApiProperty({
            description: 'Colonia del municipio donde reside',
            example: 'Alameda',
        })
    Colonia?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El campo Calle no puede tener más de 100 caracteres'})
    @ApiProperty({
            description: 'Calle del municipio donde reside',
            example: 'Alvaro Obregon',
        })
    Calle?:string;

    @IsOptional()
    @MaxLength(45,{message: 'El campo EntreCalles no puede tener más de 45 caracteres'})
    @ApiProperty({
            description: 'Un ejemplo entre que calles se encuentra tu localidad',
            example: 'Oaxaca y y Yucatan',
        })
    EntreCalles?:string;

    @IsOptional()
    @MaxLength(10,{message: 'El campo NumeroExterior no puede tener más de 10 caracteres'})
    @ApiProperty({
            description: 'El numero exterior de tu localidad',
            example: '500',
        })
    NumeroExterior?:string;

    @IsOptional()
    @MaxLength(10,{message: 'El campo NumeroInterior no puede tener más de 10 caracteres'})
    @ApiProperty({
            description: 'El numero interior de tu localidad si existe',
            example: '2',
        })
    NumeroInterior?:string;

    @IsOptional()
    @Matches(/^[0-9]{5}$/, { message: 'El código postal no puede tener más de 5 dígitos' })
    @ApiProperty({
            description: 'Numero del codigo postal de tu residencia',
            example: '12345',
        })
    CP?:string;

    @IsOptional()
    @MaxLength(100,{message: 'El campo NombreEncargado no puede tener más de 100 caracteres'})
    @ApiProperty({
            description: 'Nombre del encargado',
            example: 'Jose',
        })
    NombreEncargado?:string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, { message: 'Teléfono inválido' })
    @ApiProperty({
            description: 'Numero del encargado',
            example: '7776665544',
        })
    TelefonoEncargado?:string;

    @IsOptional()
    @IsEmail()
    @MaxLength(100,{message: 'El correo no puede tener más de 100 caracteres'})
    @ApiProperty({
            description: 'Correo electronico del encargado',
            example: 'correo@ejemplo.com',
        })
    EmailEncargado?:string;
}
