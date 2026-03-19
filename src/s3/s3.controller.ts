import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { UploadDto } from './dto/update-s3.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

@ApiTags('S3 - archivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard)
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Subir archivo a S3',
    description:
      'Sube un archivo al bucket S3. Formatos permitidos: PNG, JPG, JPEG, PDF. Tamaño máximo: 10 MB. El campo file debe contener el archivo y el body debe incluir folder e idModule.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'folder', 'idModule'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo a subir (PNG, JPG, JPEG o PDF)',
        },
        folder: {
          type: 'string',
          enum: ['clientes', 'operadores', 'usuarios', 'vehiculos', 'pasajeros'],
          description: 'Carpeta destino en el bucket',
        },
        idModule: {
          type: 'string',
          description: 'ID del módulo asociado',
          example: '1',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Archivo subido correctamente',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL pública del archivo en S3',
          example: 'https://bucket.s3.region.amazonaws.com/clientes/uuid.png',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Archivo requerido, tipo no permitido o tamaño excedido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error al subir el archivo a S3' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // máximo 10 MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new Error('Solo se permiten PNG, JPG, JPEG o PDF'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDto,
    @Request() req,
  ) {
    const { folder, idModule } = body;
    const idUser = req.user.userId;

    if (!file) throw new BadRequestException('Archivo requerido');

    return this.s3Service.uploadFile(file, folder, idUser, Number(idModule));
  }
}
