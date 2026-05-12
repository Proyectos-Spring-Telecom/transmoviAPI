-- Ejecutar si la tabla HistoricoInstalaciones aún no tiene la columna JSON de snapshot de dispositivos.
ALTER TABLE HistoricoInstalaciones
  ADD COLUMN IdsDispositivos JSON NULL AFTER IdDispositivo;
