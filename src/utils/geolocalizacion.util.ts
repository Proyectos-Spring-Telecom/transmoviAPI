import haversine from 'haversine-distance';

export interface Punto {
  lat: number;
  lng: number;
}

/**
 * Verifica si una posición está dentro del recorrido (línea) con una tolerancia en metros.
 * @param recorrido Array de puntos que definen el derrotero
 * @param posicion Punto actual (lat, lng)
 * @param tolerancia Distancia máxima permitida en metros (ej. 50)
 */
export function estaDentroDelDerrotero(
  recorrido: Punto[],
  posicion: Punto,
  tolerancia: number = 50
): boolean {
  if (!recorrido || recorrido.length < 2) {
    throw new Error('El recorrido debe tener al menos dos puntos.');
  }

  let distanciaMinima = Infinity;

  for (let i = 0; i < recorrido.length - 1; i++) {
    const p1 = recorrido[i];
    const p2 = recorrido[i + 1];
    const distancia = distanciaPuntoALinea(posicion, p1, p2);
    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
    }
  }

  return distanciaMinima <= tolerancia;
}

/**
 * Calcula la distancia mínima de un punto a una línea (definida por dos puntos).
 * @returns distancia en metros
 */
function distanciaPuntoALinea(p: Punto, a: Punto, b: Punto): number {
  // Convertimos a radianes
  const R = 6371000; // Radio de la Tierra en metros

  // Convertir lat/lng a coordenadas cartesianas aproximadas
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRadians(a.lat);
  const lon1 = toRadians(a.lng);
  const lat2 = toRadians(b.lat);
  const lon2 = toRadians(b.lng);
  const latP = toRadians(p.lat);
  const lonP = toRadians(p.lng);

  // Convertir lat/lng a vectores cartesianos (x, y, z)
  const toXYZ = (lat: number, lon: number) => {
    const x = R * Math.cos(lat) * Math.cos(lon);
    const y = R * Math.cos(lat) * Math.sin(lon);
    const z = R * Math.sin(lat);
    return { x, y, z };
  };

  const A = toXYZ(lat1, lon1);
  const B = toXYZ(lat2, lon2);
  const P = toXYZ(latP, lonP);

  // Vector AB y AP
  const AB = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
  const AP = { x: P.x - A.x, y: P.y - A.y, z: P.z - A.z };

  // Proyección escalar
  const AB2 = AB.x ** 2 + AB.y ** 2 + AB.z ** 2;
  const t = Math.max(0, Math.min(1, (AP.x * AB.x + AP.y * AB.y + AP.z * AB.z) / AB2));

  // Punto más cercano en la línea
  const C = { x: A.x + t * AB.x, y: A.y + t * AB.y, z: A.z + t * AB.z };

  // Distancia entre P y C
  const dx = P.x - C.x;
  const dy = P.y - C.y;
  const dz = P.z - C.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
