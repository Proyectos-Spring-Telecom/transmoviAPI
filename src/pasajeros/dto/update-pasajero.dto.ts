import { PartialType } from '@nestjs/mapped-types';
import { CreatePasajeroDto } from './create-pasajero.dto';

export class UpdatePasajeroDto extends PartialType(CreatePasajeroDto) {}
