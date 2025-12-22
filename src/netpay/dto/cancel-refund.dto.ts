import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CancelRefundDto {
  @ApiProperty({
    description: 'Transaction ID de la transacción a cancelar/reembolsar',
    example: 'txn_1234567890',
  })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiPropertyOptional({
    description: 'Monto parcial a reembolsar (si no se especifica, se reembolsa el total)',
    example: 50.25,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Razón del reembolso',
    example: 'Cancelación de servicio',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
