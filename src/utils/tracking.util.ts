import {
    snapToRoute,
    calcularDistanciaHastaIndex,
    calcularDistanciaReal
} from './recorrido.utils';
import { Punto } from '../common/ApiResponse';

interface TrackingState {
    distanciaRecorrida: number;
    distanciaRestante: number;
    progreso: number;
    etaSegundos: number;
    fueraDeRuta: boolean;
}

export function calcularTracking(
    current: Punto,
    recorrido: Punto[],
    velocidadMps: number
): TrackingState {

    const { index, distanciaMetros } = snapToRoute(current, recorrido);

    const distanciaTotal = calcularDistanciaReal(recorrido);
    const distanciaRecorrida = calcularDistanciaHastaIndex(recorrido, index);
    const distanciaRestante = Math.max(
        distanciaTotal - distanciaRecorrida,
        0
    );

    return {
        distanciaRecorrida,
        distanciaRestante,
        progreso: distanciaRecorrida / distanciaTotal,
        etaSegundos:
            velocidadMps > 0
                ? distanciaRestante / velocidadMps
                : Infinity,
        fueraDeRuta: distanciaMetros > 50 // metros
    };
}
