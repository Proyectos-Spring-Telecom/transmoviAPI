import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Query,
  Param,
  BadRequestException,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload/:folder/:idModule')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(), // Para usar file.buffer
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'image/png',
          'image/jpeg', // acepta .jpg y .jpeg
          'application/pdf',
        ];
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
    @Param('folder') folder: string,
    @Param('idModule', ParseIntPipe) idModule: number,
    @Request() req,
  ) {
    const idUser = req.user.userId
    if (!file) throw new BadRequestException('Archivo requerido en campo "file"');
    return this.s3Service.uploadFile(file, folder, idUser,idModule);
  }

  @Get('url')
  async getUrl(@Query('key') key: string) {
    const url = await this.s3Service.getPresignedUrl(key);
    return { url };
  }
}
