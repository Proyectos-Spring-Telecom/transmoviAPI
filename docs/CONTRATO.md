# Contrato de API – TransmoviAPI

## Información general

| Propiedad | Valor |
|-----------|-------|
| **Base URL** | `http://localhost:3010` / `https://transmovi.mx/apidev/` / `https://transmovi.mx/api/` |
| **Versión** | 2.0 |
| **Formato** | JSON |
| **Autenticación** | Bearer JWT (`Authorization: Bearer <token>`) |
| **Documentación interactiva** | `GET /docs` (Swagger UI) |

---

## Convenciones de respuesta

### Éxito (creación/actualización)
```json
{
  "status": "success",
  "message": "Mensaje descriptivo",
  "data": { "id": number, "nombre": string }
}
```

### Lista sin paginación
```json
{
  "data": [ { ... } ]
}
```

### Lista paginada
```json
{
  "data": [ { ... } ],
  "paginated": {
    "total": number,
    "page": number,
    "lastPage": number
  }
}
```

### Error
- Códigos: 400, 401, 404, 500
- Mensaje en body según `ValidationPipe` o filtros globales

---

## Endpoints por recurso

### Autenticación (`/login`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/login` | No | Login usuario/contraseña |
| POST | `/login/operador/login` | No | Login operador con PIN y deviceId |
| POST | `/login/usuario/recuperar/acceso` | No | Solicitar recuperación de acceso |
| POST | `/login/recuperar/confirmacion` | No | Confirmar recuperación con código |
| POST | `/login/pasajero/registro` | No | Registro de pasajero |
| POST | `/login/cambiar/accesso` | Sí | Cambiar contraseña (Bearer) |
| PATCH | `/login/verify` | No | Verificar código de autenticación |

---

### Usuarios (`/usuarios`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/usuarios` | Crear usuario |
| GET | `/usuarios/list` | Listar usuarios |
| GET | `/usuarios/list/cliente` | Listar usuarios por cliente |
| GET | `/usuarios/list/rol/operador/:cliente` | Operadores por cliente |
| GET | `/usuarios/:page/:limit` | Listar paginado |
| GET | `/usuarios/:id` | Obtener por ID |
| PUT | `/usuarios/actualizar/contrasena/:id` | Actualizar contraseña |
| PUT | `/usuarios/:id` | Actualizar usuario |
| PATCH | `/usuarios/generar/pin` | Generar PIN operador |
| PATCH | `/usuarios/actualizar/dispositivo` | Actualizar dispositivo |
| PATCH | `/usuarios/estatus/:id` | Cambiar estatus |
| DELETE | `/usuarios/:id` | Eliminar usuario |

---

### Clientes (`/clientes`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/clientes` | Crear cliente |
| GET | `/clientes/list` | Listar clientes |
| GET | `/clientes/list/:cliente` | Listar por cliente padre |
| GET | `/clientes/:page/:limit` | Listar paginado |
| GET | `/clientes/:id` | Obtener por ID |
| PUT | `/clientes/:id` | Actualizar cliente |
| PATCH | `/clientes/estatus/:id` | Cambiar estatus |
| DELETE | `/clientes/:id` | Eliminar cliente |

---

### Operadores (`/operadores`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/operadores` | Crear operador |
| GET | `/operadores/list` | Listar operadores |
| GET | `/operadores/by-cliente/:idCliente` | Por cliente |
| GET | `/operadores/:page/:limit` | Listar paginado |
| GET | `/operadores/:id` | Obtener por ID |
| PUT | `/operadores/:id` | Actualizar operador |
| PATCH | `/operadores/estatus/:id` | Cambiar estatus |
| DELETE | `/operadores/:id` | Eliminar operador |

---

### Vehículos (`/vehiculos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/vehiculos` | Crear vehículo |
| GET | `/vehiculos/list` | Listar vehículos |
| GET | `/vehiculos/by-cliente/:idCliente` | Por cliente |
| GET | `/vehiculos/clientes/:id` | Vehículos y dispositivos del cliente |
| GET | `/vehiculos/:page/:limit` | Listar paginado |
| GET | `/vehiculos/:id` | Obtener por ID |
| PUT | `/vehiculos/:id` | Actualizar vehículo |
| PATCH | `/vehiculos/estatus/:id` | Cambiar estatus |
| DELETE | `/vehiculos/:id` | Eliminar vehículo |

---

### Dispositivos (`/dispositivos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/dispositivos` | Crear dispositivo |
| GET | `/dispositivos/list` | Listar dispositivos |
| GET | `/dispositivos/by-cliente/:idCliente` | Por cliente |
| GET | `/dispositivos/clientes/:id` | Dispositivos del cliente |
| GET | `/dispositivos/:page/:limit` | Listar paginado |
| GET | `/dispositivos/:id` | Obtener por ID |
| PUT | `/dispositivos/:id` | Actualizar dispositivo |
| PATCH | `/dispositivos/actualizar/estado/:id` | Actualizar estado |
| PATCH | `/dispositivos/estatus/:id` | Cambiar estatus |
| DELETE | `/dispositivos/:id` | Eliminar dispositivo |

---

### BlueVox (`/bluevox`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/bluevox` | Crear BlueVox |
| GET | `/bluevox/list` | Listar BlueVox |
| GET | `/bluevox/clientes/:id` | Por cliente |
| GET | `/bluevox/:page/:limit` | Listar paginado |
| GET | `/bluevox/:id` | Obtener por ID |
| PUT | `/bluevox/:id` | Actualizar BlueVox |
| PATCH | `/bluevox/actualizar/estado/:id` | Actualizar estado |
| PATCH | `/bluevox/estatus/:id` | Cambiar estatus |
| DELETE | `/bluevox/:id` | Eliminar BlueVox |

---

### Instalaciones (`/instalaciones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/instalaciones` | Crear instalación |
| GET | `/instalaciones/list` | Listar instalaciones |
| GET | `/instalaciones/:page/:limit` | Listar paginado |
| GET | `/instalaciones/:id` | Obtener por ID |
| PUT | `/instalaciones/:id` | Actualizar instalación |
| PATCH | `/instalaciones/estatus/:id` | Cambiar estatus |
| DELETE | `/instalaciones/:id` | Eliminar instalación |

---

### Regiones (`/regiones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/regiones` | Crear región |
| GET | `/regiones/list` | Listar regiones |
| GET | `/regiones/by-cliente/:idCliente` | Por cliente |
| GET | `/regiones/:page/:limit` | Listar paginado |
| GET | `/regiones/:id` | Obtener por ID |
| PUT | `/regiones/:id` | Actualizar región |
| PATCH | `/regiones/estatus/:id` | Cambiar estatus |
| DELETE | `/regiones/:id` | Eliminar región |

---

### Rutas (`/rutas`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/rutas` | Crear ruta |
| GET | `/rutas/list` | Listar rutas |
| GET | `/rutas/by-region/:idRegion` | Por región |
| GET | `/rutas/:page/:limit` | Listar paginado |
| GET | `/rutas/:id` | Obtener por ID |
| PUT | `/rutas/:id` | Actualizar ruta |
| PATCH | `/rutas/estatus/:id` | Cambiar estatus |
| DELETE | `/rutas/:id` | Eliminar ruta |

---

### Derroteros (`/derroteros`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/derroteros` | Crear derrotero |
| GET | `/derroteros/list` | Listar derroteros |
| GET | `/derroteros/by-ruta/:idRuta` | Por ruta |
| GET | `/derroteros/:page/:limit` | Listar paginado |
| GET | `/derroteros/:id` | Obtener por ID |
| PUT | `/derroteros/:id` | Actualizar derrotero |
| PATCH | `/derroteros/estatus/:id` | Cambiar estatus |
| DELETE | `/derroteros/:id` | Eliminar (lógico) |
| DELETE | `/derroteros/eliminado/total/:id` | Eliminar (físico, SuperAdmin) |

---

### Tarifas (`/tarifas`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/tarifas` | Crear tarifa |
| GET | `/tarifas/list` | Listar tarifas |
| GET | `/tarifas/:page/:limit` | Listar paginado |
| GET | `/tarifas/:id` | Obtener por ID |
| PUT | `/tarifas/:id` | Actualizar tarifa |
| PATCH | `/tarifas/estatus/:id` | Cambiar estatus |
| DELETE | `/tarifas/:id` | Eliminar (lógico) |
| DELETE | `/tarifas/eliminado/total/:id` | Eliminar (físico, SuperAdmin) |

---

### Turnos (`/turnos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/turnos` | Crear turno (apertura) |
| GET | `/turnos/list` | Listar turnos |
| GET | `/turnos/:page/:limit` | Listar paginado |
| GET | `/turnos/:id` | Obtener por ID |
| PATCH | `/turnos/:id` | Actualizar turno (cierre). Cierra automáticamente todos los viajes abiertos del turno antes de cerrarlo. Body: `numeroSerieDispositivo` |
| PATCH | `/turnos/estatus/:id` | Cambiar estatus |
| DELETE | `/turnos/:id` | Eliminar turno |

---

### Viajes (`/viajes`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/viajes` | Crear viaje |
| PATCH | `/viajes/:id` | Actualizar viaje (cierre) |
| GET | `/viajes/list` | Listar viajes |
| GET | `/viajes/:page/:limit` | Listar paginado |
| GET | `/viajes/:id` | Obtener por ID |

---

### Pasajeros (`/pasajeros`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/pasajeros` | Crear pasajero |
| GET | `/pasajeros/list` | Listar pasajeros |
| GET | `/pasajeros/main/:idUsuario` | Pasajero principal por usuario |
| GET | `/pasajeros/:page/:limit` | Listar paginado |
| GET | `/pasajeros/:id` | Obtener por ID |
| PUT | `/pasajeros/:id` | Actualizar pasajero |
| PATCH | `/pasajeros/estado/solicitud/:id` | Actualizar estado solicitud |
| PATCH | `/pasajeros/estatus/:id` | Cambiar estatus |
| DELETE | `/pasajeros/:id` | Eliminar pasajero |

---

### Monederos (`/monederos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/monederos` | Crear monedero |
| POST | `/monederos/reporte/extravio` | Reportar extravío |
| GET | `/monederos/list` | Listar monederos |
| GET | `/monederos/numero/serie/:idCard` | Por número de serie |
| GET | `/monederos/:page/:limit` | Listar paginado |
| GET | `/monederos/:id` | Obtener por ID |
| PUT | `/monederos/:id` | Actualizar monedero |
| PATCH | `/monederos/tipo/pasajero/:id` | Actualizar tipo pasajero |
| PATCH | `/monederos/estatus/:id` | Cambiar estatus |
| DELETE | `/monederos/:id` | Eliminar monedero |

---

### Transacciones (`/transacciones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/transacciones/debito` | Crear/cerrar débito (validación) |
| POST | `/transacciones/recarga` | Crear recarga |
| POST | `/transacciones/paginado` | Listar débitos paginados |
| POST | `/transacciones/paginado/recargas` | Listar recargas paginadas |
| GET | `/transacciones/list` | Listar transacciones |
| GET | `/transacciones/DEBITO/:id` | Obtener débito por ID |
| GET | `/transacciones/RECARGA/:id` | Obtener recarga por ID |

---

### Conteo pasajeros (`/conteopasajeros`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/conteopasajeros` | Crear registro de conteo |
| PATCH | `/conteopasajeros/:id` | Actualizar conteo |
| GET | `/conteopasajeros/list` | Listar |
| GET | `/conteopasajeros/hoy` | Conteos del día |
| GET | `/conteopasajeros/ultima-semana` | Última semana |
| GET | `/conteopasajeros/fecha/:fecha` | Por fecha |
| GET | `/conteopasajeros/rango/:fechaInicio/:fechaFin` | Por rango |
| GET | `/conteopasajeros/fecha-hora/:fecha/:hora` | Por fecha y hora |
| GET | `/conteopasajeros/bluevox/:numeroSerie/hoy` | Por BlueVox hoy |
| GET | `/conteopasajeros/bluevox/:numeroSerie/rango/:fechaInicio/:fechaFin` | Por BlueVox rango |
| GET | `/conteopasajeros/resumen-horas/:fecha` | Resumen por horas |
| GET | `/conteopasajeros/resumen-diario/:year/:month` | Resumen diario |
| GET | `/conteopasajeros/:page/:limit` | Listar paginado |
| GET | `/conteopasajeros/:id` | Obtener por ID |

---

### Posiciones (`/posiciones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/posiciones` | Registrar posición GPS |
| PATCH | `/posiciones/:id` | Actualizar posición |
| GET | `/posiciones/list` | Listar posiciones |
| GET | `/posiciones/:page/:limit` | Listar paginado |
| GET | `/posiciones/:id` | Obtener por ID |

---

### Monitoreo (`/monitoreo`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/monitoreo/list/:cliente` | Posiciones en tiempo real por cliente |
| POST | `/monitoreo/recorrido` | Recorrido del día por dispositivo |

---

### Reportes (`/reportes`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/reportes/recaudacion-diaria-ruta` | Recaudación diaria por ruta |
| POST | `/reportes/recaudacion-por-operador` | Recaudación por operador |
| POST | `/reportes/recaudacion-por-vehiculo` | Recaudación por vehículo |
| POST | `/reportes/recaudacion-por-dispositivo` | Recaudación por dispositivo |

---

### Dashboard (`/dashboard`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/dashboard/kpi` | Obtener KPIs |

---

### S3 – Archivos (`/s3`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/s3/upload` | Subir archivo (multipart/form-data: file, folder, idModule) |

---

### Módulos del sistema (`/modulos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/modulos` | Crear módulo |
| GET | `/modulos/list` | Listar módulos |
| GET | `/modulos/:page/:limit` | Listar paginado |
| GET | `/modulos/:id` | Obtener por ID |
| PUT | `/modulos/:id` | Actualizar módulo |
| PATCH | `/modulos/:id/estatus` | Cambiar estatus |
| DELETE | `/modulos/:id` | Eliminar módulo |

---

### Permisos (`/permisos`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/permisos` | Crear permiso |
| GET | `/permisos/list` | Listar permisos |
| GET | `/permisos/permisosAgrupados` | Permisos agrupados por módulo |
| GET | `/permisos/:page/:limit` | Listar paginado |
| GET | `/permisos/:id` | Obtener por ID |
| PUT | `/permisos/:id` | Actualizar permiso |
| PATCH | `/permisos/:id/estatus` | Cambiar estatus |
| DELETE | `/permisos/:id` | Eliminar permiso |

---

### Roles (`/roles`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/roles` | Crear rol |
| GET | `/roles/list` | Listar roles |
| GET | `/roles/:page/:limit` | Listar paginado |
| GET | `/roles/:id` | Obtener por ID |
| PUT | `/roles/:id` | Actualizar rol |
| PATCH | `/roles/estatus/:id` | Cambiar estatus |
| DELETE | `/roles/:id` | Eliminar rol |

---

### Usuarios-Regiones (`/usuariosregiones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/usuariosregiones` | Crear relación |
| GET | `/usuariosregiones/list` | Listar relaciones |
| GET | `/usuariosregiones/usuario/:idUsuario` | Regiones por usuario |
| GET | `/usuariosregiones/:page/:limit` | Listar paginado |
| GET | `/usuariosregiones/:id` | Obtener por ID |
| PUT | `/usuariosregiones/:idUsuario` | Actualizar regiones del usuario |
| PATCH | `/usuariosregiones/estatus/:id` | Cambiar estatus |
| DELETE | `/usuariosregiones/:id` | Eliminar relación |

---

### Usuarios-Instalaciones (`/usuariosinstalaciones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/usuariosinstalaciones` | Crear relación |
| GET | `/usuariosinstalaciones/list` | Listar relaciones |
| GET | `/usuariosinstalaciones/usuario/:idUsuario` | Instalaciones por usuario |
| GET | `/usuariosinstalaciones/:page/:limit` | Listar paginado |
| GET | `/usuariosinstalaciones/:id` | Obtener por ID |
| PUT | `/usuariosinstalaciones/:idUsuario` | Actualizar instalaciones del usuario |
| PATCH | `/usuariosinstalaciones/:id` | Cambiar estatus |
| DELETE | `/usuariosinstalaciones/:id` | Eliminar relación |

---

### Licencias (`/licencias`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/licencias` | Crear licencia |
| GET | `/licencias/list` | Listar licencias |
| GET | `/licencias/:page/:limit` | Listar paginado |
| GET | `/licencias/:id` | Obtener por ID |
| PUT | `/licencias/:id` | Actualizar licencia |
| DELETE | `/licencias/:id` | Eliminar licencia |

---

### Talleres (`/talleres`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/talleres` | Crear taller |
| GET | `/talleres/list` | Listar talleres |
| GET | `/talleres/:page/:limit` | Listar paginado |
| GET | `/talleres/:id` | Obtener por ID |
| PATCH | `/talleres/:id` | Actualizar taller |
| PATCH | `/talleres/desactivar/:id` | Desactivar |
| PATCH | `/talleres/activar/:id` | Activar |

---

### Mantenimiento vehicular (`/mantenimiento-vehicular`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/mantenimiento-vehicular` | Crear registro |
| GET | `/mantenimiento-vehicular/:page/:limit` | Listar paginado |
| GET | `/mantenimiento-vehicular/:id` | Obtener por ID |
| PATCH | `/mantenimiento-vehicular/:id` | Actualizar |
| PATCH | `/mantenimiento-vehicular/:id/desactivar` | Desactivar |
| PATCH | `/mantenimiento-vehicular/:id/activar` | Activar |
| PATCH | `/mantenimiento-vehicular/:id/estatus/:estatus` | Cambiar estatus |

---

### Mantenimiento combustible (`/mantenimiento-combustible`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/mantenimiento-combustible` | Crear registro |
| GET | `/mantenimiento-combustible/:page/:limit` | Listar paginado |
| GET | `/mantenimiento-combustible/:id` | Obtener por ID |
| PATCH | `/mantenimiento-combustible/:id` | Actualizar |
| PATCH | `/mantenimiento-combustible/:id/desactivar` | Desactivar |
| PATCH | `/mantenimiento-combustible/:id/activar` | Activar |

---

### Mantenimiento kilometraje (`/mantenimiento-kilometraje`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/mantenimiento-kilometraje` | Crear registro |
| GET | `/mantenimiento-kilometraje/:page/:limit` | Listar paginado |
| GET | `/mantenimiento-kilometraje/:id` | Obtener por ID |
| PATCH | `/mantenimiento-kilometraje/:id` | Actualizar |
| PATCH | `/mantenimiento-kilometraje/:id/desactivar` | Desactivar |
| PATCH | `/mantenimiento-kilometraje/:id/activar` | Activar |

---

### Verificaciones (`/verificaciones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/verificaciones` | Crear verificación (multipart) |
| GET | `/verificaciones` | Listar paginado (query: page, limit) |
| GET | `/verificaciones/categorias-mantenimiento-mecanico` | Categorías mecánicas |
| GET | `/verificaciones/:id` | Obtener por ID |
| PATCH | `/verificaciones/:id` | Actualizar verificación |
| PATCH | `/verificaciones/:id/desactivar` | Desactivar |
| PATCH | `/verificaciones/:id/activar` | Activar |

---

### Incidentes (`/incidentes`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/incidentes` | Crear incidente |
| GET | `/incidentes` | Listar (query: page, limit) |
| GET | `/incidentes/:id` | Obtener por ID |
| PATCH | `/incidentes/:id` | Actualizar incidente |
| PATCH | `/incidentes/:id/desactivar` | Desactivar |
| PATCH | `/incidentes/:id/activar` | Activar |
| PATCH | `/incidentes/:id/estatus/:estatus` | Cambiar estatus |

---

### Histórico instalaciones (`/historicoinstalaciones`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/historicoinstalaciones` | Listar |
| GET | `/historicoinstalaciones/:id` | Obtener por ID |

---

### Bitácora (`/bitacora`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/bitacora/list` | Listar |
| GET | `/bitacora/:page/:limit` | Listar paginado |
| GET | `/bitacora/:id` | Obtener por ID |

---

### Catálogos (solo lectura o CRUD básico)

| Recurso | Ruta base | Endpoints típicos |
|---------|-----------|-------------------|
| Tipos pasajeros | `/cattiposasajeros` | CRUD + `clientes/:id` |
| Categoría licencia | `/catcategorialicencia` | GET list |
| Tipo licencia | `/cattipolicencia` | GET list |
| Tipo descuento | `/cattipodescuento` | GET list |
| Tipo transacciones | `/cattipotransacciones` | GET list |
| Combustible | `/cattipocombustible` | GET list |
| Método pago | `/catmetodopago` | GET list |
| Estatus mantenimiento | `/cat-estatus-mantenimiento` | CRUD |
| Referencia servicio | `/cat-referencia-servicio` | CRUD |
| Tipo combustible | `/cat-tipo-combustible` | CRUD |
| Tipo verificaciones | `/cat-tipo-verificaciones` | CRUD |

---

## Notas del contrato

1. **Paginación:** `:page` y `:limit` son numéricos; la primera página suele ser 1.
2. **Estatus:** 0 = Inactivo, 1 = Activo (salvo excepciones documentadas).
3. **Eliminación:** La mayoría de DELETE son lógicos (cambio de estatus).
4. **Multipart:** S3 y Verificaciones usan `multipart/form-data`.
5. **Fechas:** Formato ISO 8601 / YYYY-MM-DD según el endpoint.
6. **Cierre de turno:** Al cerrar un turno (`PATCH /turnos/:id`), se cierran automáticamente todos los viajes abiertos del turno (incluidas transacciones y conteos asociados).
