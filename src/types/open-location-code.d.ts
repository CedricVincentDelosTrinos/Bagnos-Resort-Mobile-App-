declare module "open-location-code" {
    export class OpenLocationCode {
        recoverNearest(
            shortCode: string,
            referenceLatitude: number,
            referenceLongitude: number
        ): string;

        decode(code: string): {
            latitudeCenter: number;
            longitudeCenter: number;
        };
    }
}