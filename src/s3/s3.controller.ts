import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { S3Service } from './s3.service';
import { CreateS3Dto } from './dto/create-s3.dto';
import { UpdateS3Dto } from './dto/update-s3.dto';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}


}
