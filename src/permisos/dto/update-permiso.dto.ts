import { PartialType } from '@nestjs/mapped-types';
import { CreatePermisoDto } from './create-permiso.dto';

export class UpdatePermisoDto extends PartialType(CreatePermisoDto) {}
