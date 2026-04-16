package CameraSystem {
    part def Camera {
        attribute resolution : Real;
        attribute focalLength : Real;

        part lens : Lens;
        part sensor : ImageSensor;
    }

    part def Lens {
        attribute aperture : Real;
    }

    part def ImageSensor {
        attribute pixelCount : Integer;
        attribute sensorSize : Real;
    }
}
