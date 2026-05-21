# Contrato API — TransmoviAPI (fragmento operativo)

Documenta convenciones y el endpoint **resumen por viaje** tal como está implementado hoy. Otras rutas pueden seguir el mismo patón de respuesta; Swagger (`/api` o la ruta configurada en `main.ts`) es la fuente viva para el catálogo completo.

## Autenticación

- Cabecera: `Authorization: Bearer <JWT>`.
- Guard: `JwtAuthGuard` en los endpoints protegidos.
- El token debe aportar (uso típico en controladores): `req.user.userId`, `req.user.cliente`, `req.user.rol` (**IdRol** numérico; catálogo en [CONTEXTO.md](./CONTEXTO.md#roles-del-sistema-roles)).

## Formato de respuesta común — listas paginadas (`ApiResponseCommon`)

```typescript
interface Paginated {
  total: number;
  page: number;
  lastPage: number;
}

interface ApiResponseCommon {
  data: any[];
  paginated?: Paginated;
}
```

- `data`: arreglo de ítems de la página actual.
- `paginated`: totales globales y metadatos de paginación (`lastPage` suele calcularse como `ceil(total / limit)` cuando `limit > 0`).

## GET `/conteopasajeros/resumen-por-viaje/:fechaInicio/:fechaFin`

### Descripción

Lista **paginada de viajes** con resumen de ascensos (conteo) vs boletos (histórico débito por viaje), vehículo en JSON y arreglo de BlueVox con conteos anidados.

### Parámetros de ruta

| Nombre | Formato | Obligatorio |
|--------|-----------|-------------|
| `fechaInicio` | `YYYY-MM-DD` | Sí |
| `fechaFin` | `YYYY-MM-DD` | Sí |

Las fechas se expanden en servidor a `fechaInicioT00:00:00` y `fechaFinT23:59:59` para el filtro de **actividad** (inclusión del viaje en la lista).

### Query

| Nombre | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `page` | number | `1` | Página (≥ 1). |
| `limit` | number | `10` | Tamaño de página. |

### Códigos HTTP

| Código | Situación |
|--------|-----------|
| 200 | Éxito; cuerpo `ApiResponseCommon`. |
| 401 | No autenticado o token inválido. |
| 500 | Error interno al ejecutar la consulta (mensaje encapsulado en excepción Nest). |

### Cuerpo de éxito — forma de cada elemento en `data`

Cada elemento es un objeto plano (los campos JSON ya vienen parseados desde columnas `JSON_*` en el servicio):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `idViaje` | number | Id del viaje. |
| `inicioViaje` | string / Date | Inicio del viaje (según driver). |
| `finViaje` | string / Date \| null | Fin del viaje. |
| `idCliente` | number | Cliente del viaje. |
| `totalAscensos` | number | Suma histórica `Entradas - Salidas` en `ConteoPasajeros` para el viaje (reglas por rol). |
| `totalBoletos` | number | Cantidad de filas en `HistoricoTransaccionesDebito` con `IdViajes = idViaje` y tipo **débito** (sin filtrar por rango de fechas en la subconsulta). |
| `diferenciaAscensoBoleto` | number | `totalAscensos - totalBoletos`. |
| `vehiculo` | object | `{ idVehiculo, placa, marca, modelo, numeroEconomico }`. |
| `blueVoxs` | array | Lista de `{ idBlueVox, numeroSerie, conteos }` donde `conteos` es arreglo de `{ idConteo, entradas, salidas, diferencia, fechaHora }` **sin** recorte por el rango del listado. |

### Semántica del rango de fechas (contrato de negocio)

- El rango **solo** decide si el viaje **aparece** en la página (hay conteo o débito en ese intervalo).
- **No** limita el cálculo de `totalAscensos`, `totalBoletos` ni el listado completo de `conteos` dentro de cada BlueVox para ese viaje.

### Ejemplo de forma (ilustrativo)

```json
{
  "data": [
    {
      "idViaje": 123,
      "inicioViaje": "2026-05-01T08:00:00.000Z",
      "finViaje": null,
      "idCliente": 6,
      "totalAscensos": 150,
      "totalBoletos": 148,
      "diferenciaAscensoBoleto": 2,
      "vehiculo": {
        "idVehiculo": 10,
        "placa": "ABC-123",
        "marca": "Marca",
        "modelo": "Modelo",
        "numeroEconomico": "E-01"
      },
      "blueVoxs": [
        {
          "idBlueVox": 5,
          "numeroSerie": "BV-001",
          "conteos": [
            {
              "idConteo": 1,
              "entradas": 10,
              "salidas": 2,
              "diferencia": 8,
              "fechaHora": "2026-04-30T12:00:00.000Z"
            }
          ]
        }
      ]
    }
  ],
  "paginated": {
    "total": 42,
    "page": 1,
    "lastPage": 5
  }
}
```

### Caso jerarquía sin clientes

Si el rol usa jerarquía y `spGetClientes` no devuelve IDs, la API responde **200** con `data: []` y `paginated: { total: 0, page, lastPage: 0 }`.

## Nota sobre Swagger

La descripción del tag **Conteo pasajeros** en el controlador puede quedar desfasada respecto al contrato anterior (“conteos en rango”). La fuente de verdad para consumidores es **este documento** + el código en `findResumenAscensosVsBoletosPorViaje` hasta que se alinee la anotación `@ApiOperation`.
