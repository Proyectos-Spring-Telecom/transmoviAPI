# Contexto del Proyecto – TransmoviAPI

## 1. Visión general

**TransmoviAPI** es una API REST desarrollada con **NestJS 11** para el sistema de gestión de transporte público **Transmovi**. Permite la administración integral de operaciones de transporte: flota vehicular, monederos electrónicos, transacciones de recarga y débito, monitoreo en tiempo real, conteo de pasajeros y reportes de recaudación.

- **Versión:** 2.0.0  
- **Base URL local:** `http://localhost:3010`  
- **Documentación Swagger:** `/docs`  
- **Motor de base de datos:** MySQL  

---

## 2. Dominio de negocio

### 2.1 Actores principales

| Actor         | Descripción                                                                 |
|---------------|-----------------------------------------------------------------------------|
| **SuperAdministrador** | Acceso total al sistema, todos los clientes y datos.                    |
| **Administrador**      | Gestión de su cliente y entidades asociadas.                             |
| **Operador**           | Conducción de vehículos, apertura/cierre de turnos y viajes.             |
| **Pasajero**           | Uso de monedero electrónico para pagar viajes.                           |
| **Capturista/Reportes**| Consulta y generación de reportes, sin cambios críticos.                 |

### 2.2 Modelo de datos conceptual

```
Clientes (multi-tenant)
  ├── Vehículos
  ├── Dispositivos (GPS)
  ├── BlueVox (conteo pasajeros)
  ├── Regiones
  ├── Rutas
  ├── Operadores
  └── Usuarios

Instalaciones = Vehículo + Dispositivo + BlueVox (unidad operativa)

Flujo operativo:
  Turno (operador + vehículo) → Viajes → Transacciones (débito) / Conteo (BlueVox)
  Monedero → Recarga → Transacciones (débito por validación)
```

### 2.3 Procesos principales

1. **Autenticación:** Usuario/operador/pasajero con JWT o PIN.  
2. **Recarga:** Pasajero recarga monedero (efectivo/tarjeta).  
3. **Validación:** Pasajero valida en dispositivo; se debita tarifa del monedero.  
4. **Turnos:** Operador abre/cierra turno, asocia vehículo y dispositivo. Al cerrar un turno, se cierran automáticamente todos los viajes abiertos asociados (y sus transacciones/conteos).  
5. **Viajes:** Apertura/cierre de viaje por derrotero.  
6. **Conteo:** BlueVox registra pasajeros por viaje.  
7. **Monitoreo:** Posiciones GPS en tiempo real para flota.  
8. **Reportes:** Recaudación por ruta, operador, vehículo, dispositivo.  

---

## 3. Arquitectura técnica

### 3.1 Stack tecnológico

| Capa        | Tecnología                 | Uso                                      |
|-------------|----------------------------|------------------------------------------|
| Framework   | NestJS 11                  | API REST modular                         |
| ORM         | TypeORM 0.3                | Acceso a base de datos                   |
| BD          | MySQL                      | Persistencia                             |
| Autenticación | JWT + Passport           | Tokens y estrategias                     |
| Validación  | class-validator, Joi       | DTOs y configuración                     |
| Documentación | Swagger / OpenAPI        | Interfaz en `/docs`                      |
| Storage     | AWS S3                     | Archivos (imágenes, PDF)                 |
| Email       | Nodemailer                 | Confirmación y recuperación de acceso    |
| Cron        | @nestjs/schedule           | Cierre de transacciones y turnos         |

### 3.2 Estructura de directorios

```
src/
├── auth/                    # Autenticación, login, JWT
├── bitacora/                # Registro de acciones
├── bluevox/                 # Dispositivos de conteo
├── clientes/                # Gestión de clientes
├── conteopasajeros/         # Conteo de pasajeros
├── dashboard/               # KPIs
├── derroteros/              # Derroteros por ruta
├── dispositivos/            # Dispositivos GPS
├── entities/                # Entidades TypeORM (52 archivos)
├── guard/                   # JwtAuthGuard, etc.
├── historicoinstalaciones/  # Histórico de instalaciones
├── instalaciones/           # Vehículo + Dispositivo + BlueVox
├── incidentes/              # Incidentes
├── licencias/               # Licencias de operadores
├── mantenimiento-*          # Mantenimiento vehicular, combustible, kilometraje
├── modulos/                 # Módulos del sistema
├── monederos/               # Monederos electrónicos
├── monitoreo/               # Monitoreo en tiempo real
├── operadores/              # Operadores
├── pasajeros/               # Pasajeros
├── permisos/                # Permisos por módulo
├── posiciones/              # Posiciones GPS
├── regiones/                # Regiones geográficas
├── reportes/                # Reportes de recaudación
├── roles/                   # Roles
├── rutas/                   # Rutas de transporte
├── s3/                      # Carga de archivos
├── talleres/                # Talleres
├── tarifas/                 # Tarifas
├── transacciones/           # Recargas y débitos
├── turnos/                  # Turnos de operadores
├── usuarios/                # Usuarios
├── usuariosinstalaciones/   # Usuario–Instalación
├── usuariosregiones/        # Usuario–Región
├── vehiculos/               # Vehículos
├── verificaciones/          # Verificaciones vehiculares
├── viajes/                  # Viajes
├── cattipo* / cat-*         # Catálogos
├── app.module.ts
└── main.ts
```

### 3.3 Patrones aplicados

- **Módulos NestJS** por dominio.  
- **Guard JWT** en casi todos los endpoints.  
- **ValidationPipe global** con `whitelist`, `forbidNonWhitelisted`, `transform`.  
- **Filtro global** para respuestas HTTP.  
- **CORS** configurado (en producción conviene restringir orígenes).  

---

## 4. Autenticación y seguridad

### 4.1 Tipos de acceso

| Tipo        | Endpoint                          | Método                |
|------------|-----------------------------------|------------------------|
| Usuario    | `POST /login`                     | userName, password     |
| Operador   | `POST /login/operador/login`      | userName, pinHash, deviceId |
| Pasajero   | `POST /login/pasajero/registro`   | Registro + confirmación |
| Recuperación | `POST /login/usuario/recuperar/acceso` | Correo               |
| Cambio pass | `POST /login/cambiar/accesso`     | Bearer + nueva contraseña |

### 4.2 Payload JWT

```json
{
  "userId": number,
  "email": string,
  "cliente": number,
  "rol": number,
  "idOperador": number | null
}
```

### 4.3 Permisos

- Permisos por módulo (`Permisos` → `Modulos`).  
- Roles con conjuntos de permisos (`Roles` → `UsuariosPermisos`).  
- Acceso por cliente (multi-tenant).  

---

## 5. Integraciones externas

| Servicio      | Uso                              |
|---------------|-----------------------------------|
| **AWS S3**    | Subida de archivos (clientes, operadores, etc.) |
| **Nodemailer**| Correos de confirmación y recuperación |
| **Haversine** | Cálculo de distancias para tarifas |

---

## 6. Tareas programadas (Cron)

| Hora  | Tarea                                                                 |
|-------|-----------------------------------------------------------------------|
| 01:30 | Cierre de transacciones, viajes y turnos abiertos                     |
| 02:30 | Migración de transacciones a histórico y limpieza de tablas activas   |

---

## 7. Variables de entorno requeridas

| Variable              | Descripción        |
|-----------------------|--------------------|
| DB_HOST               | Host MySQL         |
| DB_PORT               | Puerto MySQL       |
| DB_USER               | Usuario MySQL      |
| DB_PASSWORD           | Contraseña MySQL   |
| DB_DATABASE           | Base de datos      |
| JWT_SECRET            | Secreto JWT        |
| JWT_EXPIRES_IN        | Expiración JWT     |
| JWT_CONFIRMACION      | Expiración tokens de correo |
| AWS_REGION            | Región AWS         |
| AWS_ACCESS_KEY_ID     | Access Key AWS     |
| AWS_SECRET_ACCESS_KEY | Secret Key AWS     |
| AWS_S3_BUCKET         | Bucket S3          |
| UPLOAD_MAX_SIZE       | Tamaño máximo de archivo |
| PORT                  | Puerto API (default: 3010) |

---

## 8. Flujo de datos críticos

### 8.1 Transacción de débito (validación)

1. Dispositivo/envía: `idMonedero`, `idDispositivo`, `idDerrotero`, coordenadas.  
2. API valida saldo, tarifa y ubicación.  
3. Se crea o cierra `TransaccionDebito`.  
4. Se actualiza saldo del monedero.  

### 8.2 Recarga

1. Cliente envía: `idMonedero`, `monto`, `idMetodoPago`.  
2. API crea `TransaccionRecarga`.  
3. Se actualiza saldo del monedero.  

### 8.3 Monitoreo

1. `GET /monitoreo/list/:cliente` → última posición por dispositivo.  
2. `POST /monitoreo/recorrido` → posiciones por dispositivo y fecha.  

### 8.4 Cierre de turno

1. Operador envía `PATCH /turnos/:id` con `numeroSerieDispositivo` para cerrar turno.  
2. API valida instalación, turno y permisos.  
3. **Si existen viajes abiertos** (estatus ACTIVO) del turno → se cierran uno a uno (transacciones abiertas, conteos, fin, estatus INACTIVO).  
4. Se cierra el turno (fin, estatus INACTIVO).  

---

## 9. Entidades principales

| Entidad                    | Relación principal                             |
|----------------------------|-----------------------------------------------|
| Usuarios                   | Clientes, Roles, Operadores                    |
| Clientes                   | Jerarquía (idPadre), Vehículos, Regiones       |
| Operadores                 | Usuarios, Licencias                            |
| Vehiculos                  | Clientes                                       |
| Instalaciones              | Vehículo + Dispositivo + BlueVox + Cliente     |
| Monederos                  | Pasajeros, CatTiposPasajeros, Clientes         |
| TransaccionesRecarga/Debito| Monederos, Dispositivos, Derroteros            |
| Viajes                     | Turnos, Derroteros, Operadores                 |
| Turnos                     | Operadores, Vehículos, Dispositivos, Rutas. Al cerrar, cierra viajes abiertos automáticamente |
| ConteoPasajeros            | BlueVox, Viajes                                |
| Posiciones                 | Dispositivos                                   |

---

## 10. Módulos eliminados

Los módulos **viajesconteos** y **viajestransacciones** fueron eliminados. No existen endpoints API para estas entidades. Las tablas/entidades pueden seguir en BD para compatibilidad.

---

## 11. Consideraciones para desarrollo

- Usar **Swagger** (`/docs`) como referencia de contratos.  
- Respetar **nombres de variables** y DTOs existentes.  
- La mayoría de endpoints requieren **Bearer JWT**.  
- Las respuestas suelen seguir: `{ status, message, data }` o `{ data, paginated }`.  
- `synchronize: false` en TypeORM: no modificar esquema sin migraciones.  
