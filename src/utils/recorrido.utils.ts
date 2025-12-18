import haversine from 'haversine-distance';
import { Punto, ResultadoRecorrido } from '../common/ApiResponse';

/**
 * Interpola puntos cada X metros (distancia en METROS)
 */

function interpolar(p1: Punto, p2: Punto, distancia: number): Punto[] {
  const puntos: Punto[] = [];
  const total = haversine(p1, p2);
  const pasos = Math.floor(total / distancia);

  for (let i = 1; i <= pasos; i++) {
    const lat = p1.lat + (p2.lat - p1.lat) * (i * distancia / total);
    const lng = p1.lng + (p2.lng - p1.lng) * (i * distancia / total);
    puntos.push({ lat, lng });
  }

  return puntos;
}

/**
 * Genera un recorrido detallado interpolado
 */

export async function generarRecorridoDetallado(
  recorrido: Punto[],
  distanciaInterpolacion = 100
): Promise<ResultadoRecorrido> {
  if (!recorrido || recorrido.length < 2) {
    throw new Error('El recorrido debe tener al menos dos puntos.');
  }

  let resultado: Punto[] = [recorrido[0]];
  let distanciaTotal = 0;

  for (let i = 0; i < recorrido.length - 1; i++) {
    const p1 = recorrido[i];
    const p2 = recorrido[i + 1];
    const puntos = interpolar(p1, p2, distanciaInterpolacion);

    distanciaTotal += haversine(p1, p2);
    resultado = resultado.concat(puntos);
    resultado.push(p2);
  }

  return {
    recorridoDetallado: resultado,
    distanciaKm: parseFloat((distanciaTotal / 1000).toFixed(2)),
  };


}


/**
 * Calcula la distancia real total de un recorrido
 * sumando Haversine entre puntos consecutivos.
 *
 * @returns distancia en METROS
 */
export function calcularDistanciaReal(
  recorrido: Punto[]
): number {
  if (!recorrido || recorrido.length < 2) {
    return 0;
  }

  let distanciaTotal = 0;

  for (let i = 0; i < recorrido.length - 1; i++) {
    distanciaTotal += haversine(
      recorrido[i],
      recorrido[i + 1]
    );
  }

  return distanciaTotal;
}

/**
 * Calcula la distancia real recorrida hasta un índice específico
 *
 * @returns distancia en METROS
 */
export function calcularDistanciaHastaIndex(
  recorrido: Punto[],
  index: number
): number {
  if (!recorrido || recorrido.length < 2 || index <= 0) {
    return 0;
  }

  let distancia = 0;
  const limite = Math.min(index, recorrido.length - 1);

  for (let i = 0; i < limite; i++) {
    distancia += haversine(
      recorrido[i],
      recorrido[i + 1]
    );
  }

  return distancia;
}


/**
 * Encuentra el punto más cercano en el recorrido
 *
 * @returns índice del punto más cercano y distancia en METROS
 */
export function snapToRoute(
  current: Punto,
  recorrido: Punto[]
): {
  index: number;
  distanciaMetros: number;
} {

  if (!recorrido || recorrido.length === 0) {
    return { index: -1, distanciaMetros: Infinity };
  }

  let minDist = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < recorrido.length; i++) {
    const d = haversine(current, recorrido[i]);

    if (d < minDist) {
      minDist = d;
      closestIndex = i;
    }
  }

  return {
    index: closestIndex,
    distanciaMetros: minDist,
  };
}