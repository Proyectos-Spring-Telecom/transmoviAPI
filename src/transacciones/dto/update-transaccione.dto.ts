import { PartialType } from '@nestjs/mapped-types';
import { CreateTransaccioneDto } from './create-transaccione.dto';

export class UpdateTransaccioneDto extends PartialType(CreateTransaccioneDto) {}
