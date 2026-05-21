# Contexto del proyecto — TransmoviAPI

## Qué es

API backend **NestJS 11** (`transmoviapi` v2.0.0) para operaciones Transmovi: conteo de pasajeros, viajes, transacciones, dashboard, mantenimiento, etc. Persistencia con **TypeORM** contra **MySQL** (consultas SQL en crudo donde el dominio lo exige).

## Stack relevante

- **Runtime:** Node.js, TypeScript.
- **Framework:** NestJS (módulos, guards, Swagger).
- **Auth:** JWT (`JwtAuthGuard`); el payload incluye al menos `userId`, `cliente`, `rol`.
- **Respuestas listas paginadas:** interfaz `ApiResponseCommon` (`data` + `paginated` opcional).

## Organización del código

- Cada dominio vive bajo `src/<modulo>/` con `*.module.ts`, `*.controller.ts`, `*.service.ts` y DTOs en `dto/`.
- Entidades TypeORM en `src/entities/`.
- Enumeraciones y tipos compartidos en `src/common/`.

## Roles del sistema (`Roles`)

Catálogo oficial en base de datos (tabla `Roles`). El JWT guarda **`IdRol` (número)**; el login administrativo también devuelve el objeto **`rol`** (`nombre`, `descripcion`, etc.) para etiquetar en UI.

| Id | Código / nombre | Descripción de negocio |
|----|-----------------|-------------------------|
| **1** | SA — Supér Administrador | Acceso global; sin acotar por cliente en la mayoría de listados. |
| **2** | Administrador | Administración del cliente y jerarquía (`spGetClientes`). |
| **3** | Operador | Operación en campo (viajes propios, PIN, conteos asociados al operador). |
| **8** | Reportes | Rol orientado a generación de códigos / reportes; en muchos endpoints se trata como **jerarquía** (igual que 2 y 10). |
| **9** | Pasajeros | Rol para clientes (pasajeros); en varios módulos operativos el backend **no expone listados** (p. ej. viajes paginados → vacío). |
| **10** | Capturista | Captura de datos; suele compartir patrón de **jerarquía** con 2 y 8. |
| **11** | Cajero | Operaciones financieras; en viajes listado/paginado suele ir con **9 → sin datos**. |
| **13** | Monitoreo | Visualización del recorrido; en **monitoreo** usa jerarquía; en **viajes** listado se agrupa con 2/8/10. |

### Patrones técnicos en el código (no son nombres de rol)

Los servicios no leen el nombre del rol; usan `switch (rol)` con **agrupaciones** repetidas:

| Patrón | Roles típicos | Efecto |
|--------|---------------|--------|
| **Global** | 1 | Sin filtro `IdCliente` (o equivalente). |
| **Jerarquía** | 2, 8, 10, a veces **13** | `CALL spGetClientes(?)` → `IN (...)` sobre cliente del token y descendientes. |
| **Cliente único** | 3, **default** en conteo/resumen | Solo `cliente` del token. |
| **Operador / por usuario** | 3 | Filtros por `idOperador` o `idUsuario` (viajes, etc.). |
| **Sin listado** | 9, 11 (viajes) | Respuesta vacía en algunos endpoints. |
| **Monitoreo mixto** | 1 root; 3,8,9,10,11 un cliente; **default** jerarquía (incl. 2, 13) | Ver `monitoreo.service.ts`. |

**Permisos de UI:** además del rol, cada usuario tiene filas en `UsuariosPermisos` (`idPermiso` activos en login). El menú del front suele cruzar esos IDs con el catálogo `Modulos` / `Permisos`; el backend **no** valida permiso por ruta en un guard central.

**Reportes:** los endpoints bajo `reportes` filtran por **jerarquía del `cliente` del token** y **no** ramifican por `IdRol`.

Al añadir endpoints nuevos, documentar aquí en qué patrón cae cada `IdRol` relevante.

## Módulo Conteo pasajeros (`conteopasajeros`)

### Resumen ascensos vs boletos por viaje

Implementado en `ConteopasajerosService.findResumenAscensosVsBoletosPorViaje` y expuesto en `GET /conteopasajeros/resumen-por-viaje/:fechaInicio/:fechaFin`.

**Objetivo de negocio:** por cada **Viaje**, comparar ascensos derivados de **ConteoPasajeros** con “boletos” como **COUNT** de filas en **HistoricoTransaccionesDebito** con `IdTipoTransaccion = DEBITO`, ligadas al viaje (`IdViajes`).

**Filtro de fechas (solo inclusión en la lista):**

- Un viaje **entra** en el resultado paginado si existe actividad en el rango:
  - algún `ConteoPasajeros.FechaHora`, o
  - algún `HistoricoTransaccionesDebito.FechaHoraFinal` (débito),
  - dentro de `[fechaInicio 00:00:00, fechaFin 23:59:59]`.
- **No** se filtra por `v.Inicio` / `v.Fin` del viaje para decidir inclusión.

**Totales y detalle (sin recorte por fecha):**

- `totalAscensos`: `SUM(Entradas - Salidas)` de **todo** el histórico de conteo del viaje (subconsulta por `IdViaje`), con reglas de cliente según rol.
- `totalBoletos`: `COUNT(*)` de débitos del viaje **sin** acotar por fecha en la subconsulta.
- `blueVoxs[].conteos`: detalle de conteos por serie para ese viaje, **sin** `BETWEEN` de fechas en la subconsulta anidada.

**Modelo SQL:** joins `Viajes` → `Turnos` → `Instalaciones` → `Vehiculos` → `InstalacionesBlueVoxs` (activos) → `BlueVoxs`; agregación `JSON_ARRAYAGG` + `GROUP BY` completo (`v.*` y columnas de vehículo necesarias para `ONLY_FULL_GROUP_BY`). Las variaciones por rol se arman con un objeto `pieces` (subconsultas y `WHERE`) y un único template de `sqlData` / `sqlCount`.

**Roles en este endpoint** (ver catálogo arriba):

| IdRol | Comportamiento en resumen por viaje |
|-------|-----------------------------------|
| 1 (SA) | Sin filtro de cliente (solo EXISTS de actividad en rango). |
| 2, 8, 10 | Jerarquía `spGetClientes`; filtros en `BlueVoxs`, `Dispositivos`, `Viajes` y EXISTS. |
| 3, 9, 11, 13 y **default** | Cliente fijo del token (`cliente`). |

**Nota de inclusión:** al exigir `INNER JOIN` a instalación + BlueVox del turno, un viaje sin BlueVox vinculado en esa instalación **no** aparece aunque tenga conteos o débitos en rango.

## Mantenimiento de esta documentación

Cuando cambien reglas de negocio del resumen por viaje, el orden de parámetros SQL o el shape de respuesta, actualizar **este archivo** y **CONTRATO.md** en el mismo cambio.
