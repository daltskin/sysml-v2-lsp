// Fixture: use case and requirement elements with actors, subjects, stakeholders
package UseCaseFixture {
    item def Operator;
    item def ProjectManager;

    part def Vehicle {
        attribute actualSpeed;
    }

    use case def PerformEmergencyStop {
        subject v : Vehicle;
        actor operator : Operator;
        objective {
            doc /* Perform an emergency stop of the vehicle */
        }
    }

    action def PerformEmergencyStopAction :> PerformEmergencyStop {
        first start;
        then action assessSituation;
        then action engageStop;
        then done;
    }

    requirement def VehicleMaxSpeed {
        doc /* The actual speed shall be <= max speed */
        subject vehicle : Vehicle;
        stakeholder pm : ProjectManager;
        attribute maxSpeed;
        require constraint { vehicle.actualSpeed <= maxSpeed }
    }

    requirement vehicleSpec {
        requirement vehicleMaxSpeedReq : VehicleMaxSpeed;
    }

    concern ReduceMaintenanceCosts {
        stakeholder ops : Operator;
    }
}
