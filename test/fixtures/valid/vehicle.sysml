package VehicleModel {
    part def Vehicle {
        attribute mass : Real;
        attribute maxSpeed : Real;

        part engine : Engine;
        part chassis : Chassis;

        port fuelPort : FuelPort;
    }

    part def Engine {
        attribute horsepower : Real;
        attribute displacement : Real;

        port driveShaft : ~DrivePort;
    }

    part def Chassis {
        attribute wheelbase : Real;

        part frontAxle : Axle;
        part rearAxle : Axle;
    }

    part def Axle {
        part leftWheel : Wheel;
        part rightWheel : Wheel;
    }

    part def Wheel {
        attribute diameter : Real;
    }

    port def FuelPort {
        in item fuel : Fuel;
    }

    port def DrivePort {
        out attribute torque : Real;
    }

    item def Fuel;

    connection def FuelLine {
        end source : FuelPort;
        end target : FuelPort;
    }

    requirement def SafetyRequirement {
        doc /* All vehicles must meet minimum safety standards */
        subject vehicle : Vehicle;
    }

    requirement maxSpeedLimit : SafetyRequirement {
        doc /* Vehicle speed must not exceed 250 km/h */
        require constraint { vehicle.maxSpeed <= 250 }
    }
}
