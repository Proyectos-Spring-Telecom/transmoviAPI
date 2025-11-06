export enum EstatusEnum {
  ACTIVO = 1, //activo o no usado
  INACTIVO = 0, //inactivo usado
}

export enum TipoCodigoAutenticacion {
  CONFIRMACION_CORREO = 0,
  RECUPERACION_CONTRASENA = 1,
}

export enum EstadoComponente {
  INACTIVO = 0,
  DISPONIBLE = 1,
  ASIGNADO = 2,
  MANTENIMIENTO = 3,
  DANADO = 4,
  RETIRADO = 5,
}

export enum EnumTipoTransaccion {
  RECARGA = 1,
  DEBITO = 2,
  RECHAZO = 3,
}

export enum EnumModulos {
  CLIENTES = 1,
  USUARIOS = 2,
  ROLES = 3,
  PERMISOS = 4,
  MODULOS = 5,
  USUARIOSPERMISOS = 6,
  USUARIOSREGIONES = 7,
  USUARIOSINSTALACIONES = 8,
  OPERADORES = 9,
  VEHICULOS = 10,
  DISPOSITIVOS = 11,
  BLUEVOXS = 12,
  INSTALACIONES = 13,
  TURNOS = 14,
  VIAJES = 15,
  REGIONES = 16,
  RUTAS = 17,
  DERROTEROS = 18,
  TARIFAS = 19,
  MONEDEROS = 20,
  PASAJEROS = 21,
  BITACORA = 0,
  CONTEOPASAJEROS = 23,
  POSICIONES = 24,
  TRANSACCIONES = 25,
  ADMINISTRACION = 26,
  MONITOREO = 27,
  VIAJESCONTEOS = 28,
  VIAJESTRANSACCIONES = 29,
  HISTORICOTRANSACCIONES = 30,
  CATALOGOPASAJERO = 31,
}

export enum EnumSolicitudPasajero {
  NOSOLICITADO = 0,
  SOLICITADO = 1,
  APROVADO = 2,
  RECHAZADO = 3,
}

export enum EnumTipoDescuento {
  PORCENTAJE = 1,
  MONETARIO = 2,
  NULO = 3,
}

export enum EnumEstatusMonederos {
  INACTIVO = 0,
  ACTIVO = 1,
  SUSPENDIDO = 2,
  EXTRAVIADO = 3,
  BLOQUEADO = 4,
}
