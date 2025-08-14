import { PartialType } from '@nestjs/mapped-types';
import { CreateBitacoraDto } from './create-bitacora.dto';

export class UpdateBitacoraDto extends PartialType(CreateBitacoraDto) {}
