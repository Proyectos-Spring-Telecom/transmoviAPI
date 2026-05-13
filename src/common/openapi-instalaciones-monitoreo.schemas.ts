/**
 * Fragmentos OpenAPI 3 reutilizables para documentar respuestas de
 * instalaciones, monitoreo, turnos y viajes (dispositivos / BlueVoxs).
 */

export const openApiDispositivoEnInstalacionItem = {
  type: 'object',
  description:
    'Dispositivo activo (InstalacionesDispositivos + Dispositivos) dentro de `dispositivos[]`.',
  properties: {
    idDispositivo: { type: 'number', example: 101 },
    numeroSerieDispositivo: { type: 'string', example: 'SN-0001' },
    marcaDispositivo: { type: 'string' },
    modeloDispositivo: { type: 'string' },
    principal: {
      type: 'number',
      nullable: true,
      example: 1,
      description:
        '1 = dispositivo principal de la instalación (`InstalacionesDispositivos.Principal`). null = no es principal (nunca 0).',
    },
  },
};

export const openApiBlueVoxEnInstalacionItem = {
  type: 'object',
  description: 'BlueVox activo asociado vía InstalacionesBlueVoxs.',
  properties: {
    idBlueVox: { type: 'number' },
    numeroSerieBlueVox: { type: 'string' },
    marcaBlueVox: { type: 'string' },
    modeloBlueVox: { type: 'string' },
  },
};

export const openApiInstalacionListadoItem = {
  type: 'object',
  description:
    'Instalación con arreglos `dispositivos` y `blueVoxs` (1..N). No hay un solo `idDispositivo` en la raíz: use el arreglo y el campo `principal` por elemento.',
  properties: {
    id: { type: 'number' },
    fechaCreacion: { type: 'string', format: 'date-time' },
    fechaActualizacion: { type: 'string', format: 'date-time' },
    estatus: { type: 'number' },
    idVehiculo: { type: 'number' },
    idCliente: { type: 'number' },
    dispositivos: {
      type: 'array',
      items: openApiDispositivoEnInstalacionItem,
    },
    blueVoxs: {
      type: 'array',
      items: openApiBlueVoxEnInstalacionItem,
    },
    marcaVehiculo: { type: 'string' },
    modeloVehiculo: { type: 'string' },
    placaVehiculo: { type: 'string' },
    numeroEconomicoVehiculo: { type: 'string' },
    nombreCliente: { type: 'string' },
    apellidoPaternoCliente: { type: 'string', nullable: true },
    apellidoMaternoCliente: { type: 'string', nullable: true },
    estatusCliente: { type: 'number' },
  },
};

/** Derrotero en la respuesta de `GET /monitoreo/list/:cliente` (rama derroteros). */
export const openApiMonitoreoDerroteroItem = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    nombreDerrotero: { type: 'string' },
    puntoInicio: { type: 'string', nullable: true },
    puntoFin: { type: 'string', nullable: true },
    recorridoDetallado: { type: 'string', nullable: true },
    distanciaKm: { type: 'number' },
    idCliente: { type: 'number' },
    nombreCliente: { type: 'string' },
    apellidoPaternoCliente: { type: 'string', nullable: true },
    apellidoMaternoCliente: { type: 'string', nullable: true },
    estatusCliente: { type: 'number', nullable: true },
    estatusDerrotero: { type: 'number', nullable: true },
  },
};

/**
 * Elemento de `posicion[]`: una instalación activa con última posición GPS
 * solo del dispositivo **principal** (Principal = 1). Sin principal o sin
 * `UltimaPosicion`, los campos de posición y dispositivo pueden ser null.
 */
export const openApiMonitoreoPosicionItem = {
  type: 'object',
  properties: {
    id: { type: 'number', nullable: true, description: 'Id UltimaPosicion' },
    exactitud: { type: 'number', nullable: true },
    estado: { type: 'string', nullable: true },
    velocidad: { type: 'number', nullable: true },
    direccion: { type: 'string', nullable: true },
    latitud: { type: 'number', nullable: true },
    longitud: { type: 'number', nullable: true },
    fechaHora: { type: 'string', format: 'date-time', nullable: true },
    fhRegistro: { type: 'string', format: 'date-time', nullable: true },
    numeroSerieDispositivo: { type: 'string', nullable: true },
    idDispositivo: { type: 'number', nullable: true },
    marcaDispositivo: { type: 'string', nullable: true },
    modeloDispositivo: { type: 'string', nullable: true },
    blueVoxs: {
      type: 'array',
      items: openApiBlueVoxEnInstalacionItem,
    },
    idVehiculo: { type: 'number', nullable: true },
    marcaVehiculo: { type: 'string' },
    modeloVehiculo: { type: 'string' },
    placaVehiculo: { type: 'string' },
    numeroEconomicoVehiculo: { type: 'string', nullable: true },
    foto: { type: 'string', nullable: true },
    nombreCompletoCliente: { type: 'string' },
  },
};

/** Campos comunes de turno/viaje enlazados a instalación (GET listados / detalle). */
export const openApiTurnoListadoItem = {
  type: 'object',
  description:
    'Turno con instalación expandida: `dispositivos[]` y `blueVoxs[]` (misma forma que instalaciones; `principal` en cada dispositivo).',
  properties: {
    id: { type: 'number' },
    inicio: { type: 'string', format: 'date-time', nullable: true },
    fin: { type: 'string', format: 'date-time', nullable: true },
    fechaCreacion: { type: 'string', format: 'date-time', nullable: true },
    fechaActualizacion: { type: 'string', format: 'date-time', nullable: true },
    estatus: { type: 'number' },
    idInstalacion: { type: 'number' },
    fechaCreacionInstalacion: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    fechaActualizacionInstalacion: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    estatusInstalacion: { type: 'number', nullable: true },
    dispositivos: {
      type: 'array',
      items: openApiDispositivoEnInstalacionItem,
    },
    blueVoxs: {
      type: 'array',
      items: openApiBlueVoxEnInstalacionItem,
    },
    idVehiculo: { type: 'number', nullable: true },
    marcaVehiculo: { type: 'string', nullable: true },
    modeloVehiculo: { type: 'string', nullable: true },
    placaVehiculo: { type: 'string', nullable: true },
    numeroEconomicoVehiculo: { type: 'string', nullable: true },
    idCliente: { type: 'number' },
    nombreCliente: { type: 'string', nullable: true },
    apellidoPaternoCliente: { type: 'string', nullable: true },
    apellidoMaternoCliente: { type: 'string', nullable: true },
    estatusCliente: { type: 'number', nullable: true },
    idOperador: { type: 'number' },
    fechaNacimientoOperador: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    nombreOperador: { type: 'string', nullable: true },
    apellidoPaternoOperador: { type: 'string', nullable: true },
    apellidoMaternoOperador: { type: 'string', nullable: true },
  },
};

export const openApiViajeListadoItem = {
  type: 'object',
  description:
    'Viaje con turno, instalación, `dispositivos[]`, `blueVoxs[]`, vehículo, operador, derrotero y rutas. Cada elemento de `dispositivos` incluye `principal` (1 | null).',
  properties: {
    id: { type: 'number' },
    inicio: { type: 'string', format: 'date-time', nullable: true },
    fin: { type: 'string', format: 'date-time', nullable: true },
    estatus: { type: 'number' },
    idCliente: { type: 'number' },
    nombreCliente: { type: 'string', nullable: true },
    apellidoPaternoCliente: { type: 'string', nullable: true },
    apellidoMaternoCliente: { type: 'string', nullable: true },
    idTurno: { type: 'number' },
    inicioTurno: { type: 'string', format: 'date-time', nullable: true },
    idInstalacion: { type: 'number' },
    dispositivos: {
      type: 'array',
      items: openApiDispositivoEnInstalacionItem,
    },
    blueVoxs: {
      type: 'array',
      items: openApiBlueVoxEnInstalacionItem,
    },
    idVehiculo: { type: 'number', nullable: true },
    placaVehiculo: { type: 'string', nullable: true },
    idOperador: { type: 'number' },
    idUsuario: { type: 'number', nullable: true },
    nombreOperador: { type: 'string', nullable: true },
    apellidoPaternoOperador: { type: 'string', nullable: true },
    apellidoMaternoOperador: { type: 'string', nullable: true },
    idDerrotero: { type: 'number', nullable: true },
    nombreDerrotero: { type: 'string', nullable: true },
    puntoInicioDerrotero: { type: 'string', nullable: true },
    puntoFinDerrotero: { type: 'string', nullable: true },
    distanciaKmDerrotero: { type: 'number', nullable: true },
    idRuta: { type: 'number', nullable: true },
    nombreRuta: { type: 'string', nullable: true },
    idRegion: { type: 'number', nullable: true },
    nombreRegionInicio: { type: 'string', nullable: true },
    idRegionFin: { type: 'number', nullable: true },
    nombreRegionFin: { type: 'string', nullable: true },
  },
};
