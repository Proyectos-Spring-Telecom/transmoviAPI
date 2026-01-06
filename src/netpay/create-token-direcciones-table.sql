-- Script SQL para crear la tabla TokenDirecciones
-- Esta tabla relaciona tokens de tarjeta con direcciones

CREATE TABLE IF NOT EXISTS `TokenDirecciones` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `IdDireccion` BIGINT NOT NULL,
  `TokenCard` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`Id`),
  INDEX `FK_Token_Direccion_idx` (`IdDireccion` ASC),
  CONSTRAINT `FK_Token_Direccion`
    FOREIGN KEY (`IdDireccion`)
    REFERENCES `DireccionesTarjeta` (`Id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

