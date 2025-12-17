import { Injectable } from '@nestjs/common';

interface LatLng {
    lat: number;
    lng: number;
}

@Injectable()
export class TrackingUtil {

    /**
     * Encuentra el punto más cercano en la ruta (snap) y su índice
     */
    snapToRoute(current: LatLng, recorrido: LatLng[]): { index: number; distance: number } {
        console.log('entro en tracking')
        let minDist = Infinity;
        let closestIndex = 0;

        recorrido.forEach((p, i) => {
            const d = this.haversine(current, p);
            if (d < minDist) {
                minDist = d;
                closestIndex = i;
            }
        });

        return { index: closestIndex, distance: minDist };
    }

    /**
     * Calcula la distancia entre dos puntos en km usando Haversine
     */
    haversine(p1: LatLng, p2: LatLng): number {
        const R = 6371; // km
        const dLat = this.deg2rad(p2.lat - p1.lat);
        const dLon = this.deg2rad(p2.lng - p1.lng);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(this.deg2rad(p1.lat)) *
            Math.cos(this.deg2rad(p2.lat)) *
            Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Calcula distancia recorrida y progreso
     */
    calculateProgress(current: LatLng, recorrido: LatLng[]): { distanciaRecorridaKm: number; progreso: number } {
        const { index } = this.snapToRoute(current, recorrido);
        const distanciaRecorridaKm = index * 0.1; // cada punto = 100m
        const progreso = index / recorrido.length;
        return { distanciaRecorridaKm, progreso };
    }

    /**
     * Detecta desvío
     */
    /* checkDesvio(current: LatLng, recorrido: LatLng, thresholdMeters = 50): boolean {
        const { distance } = this.snapToRoute(current, recorrido);
        return distance * 1000 > thresholdMeters;
    } */
}
