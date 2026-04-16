package Bike {

    // ─── Attribute Definitions ───────────────────────────────────
    attribute def Mass :> ISQ::MassValue;
    attribute def Length :> ISQ::LengthValue;
    attribute def Color;

    enum def BikeType {
        road;
        mountain;
        hybrid;
        electric;
    }

    enum def FrameMaterial {
        aluminum;
        steel;
        carbon;
        titanium;
    }

    // ─── Port Definitions ────────────────────────────────────────
    port def MechanicalPort {
        attribute torque : ISQ::TorqueValue;
    }

    port def HydraulicPort {
        attribute pressure : ISQ::PressureValue;
    }

    // ─── Interface Definitions ───────────────────────────────────
    interface def ChainDrive {
        end source : MechanicalPort;
        end target : MechanicalPort;
    }

    interface def BrakeCable {
        end leverEnd : MechanicalPort;
        end caliperEnd : MechanicalPort;
    }

    // ─── Part Definitions ────────────────────────────────────────
    part def Frame {
        attribute material : FrameMaterial;
        attribute frameSize : Length;
        attribute frameColor : Color;

        part seatTube : Tube;
        part downTube : Tube;
        part topTube : Tube;
        part headTube : Tube;
        part chainstay : Tube[2];
        part seatstay : Tube[2];
    }

    part def Tube {
        attribute length : Length;
        attribute diameter : Length;
    }

    part def Wheel {
        attribute diameter : Length;
        attribute mass : Mass;

        part rim : Rim;
        part tire : Tire;
        part hub : Hub;
        part spokes : Spoke[24..36];
    }

    part def Rim {
        attribute width : Length;
    }

    part def Tire {
        attribute width : Length;
        attribute treadPattern : Color;
    }

    part def Hub {
        port axlePort : MechanicalPort;
    }

    part def Spoke;

    part def Drivetrain {
        part crankset : Crankset;
        part chain : Chain;
        part cassette : Cassette;
        part derailleurs : Derailleur[1..2];

        interface chainDrive : ChainDrive connect
            crankset.outputPort to cassette.inputPort;
    }

    part def Crankset {
        attribute numberOfChainrings : ScalarValues::Integer;
        port outputPort : MechanicalPort;
        part pedals : Pedal[2];
        part crankArms : CrankArm[2];
    }

    part def CrankArm {
        attribute length : Length;
    }

    part def Pedal;

    part def Chain {
        attribute numberOfLinks : ScalarValues::Integer;
    }

    part def Cassette {
        attribute numberOfSprockets : ScalarValues::Integer;
        port inputPort : MechanicalPort;
    }

    part def Derailleur;

    part def BrakeSystem {
        part frontLever : BrakeLever;
        part rearLever : BrakeLever;
        part frontCaliper : BrakeCaliper;
        part rearCaliper : BrakeCaliper;

        interface frontBrakeCable : BrakeCable connect
            frontLever.mechPort to frontCaliper.mechPort;

        interface rearBrakeCable : BrakeCable connect
            rearLever.mechPort to rearCaliper.mechPort;
    }

    part def BrakeLever {
        port mechPort : MechanicalPort;
    }

    part def BrakeCaliper {
        port mechPort : MechanicalPort;
        part brakePads : BrakePad[2];
    }

    part def BrakePad;

    part def Handlebar {
        attribute width : Length;
        part grips : Grip[2];
    }

    part def Grip;

    part def Seat {
        attribute mass : Mass;
    }

    part def SeatPost {
        attribute height : Length;
    }

    part def Fork {
        attribute suspensionTravel : Length;
    }

    // ─── Bicycle Assembly ────────────────────────────────────────
    part def Bicycle {
        attribute bikeType : BikeType;
        attribute totalMass : Mass;

        part bikeFrame : Frame;
        part frontWheel : Wheel;
        part rearWheel : Wheel;
        part drivetrain : Drivetrain;
        part brakes : BrakeSystem;
        part handlebar : Handlebar;
        part seat : Seat;
        part seatPost : SeatPost;
        part frontFork : Fork;
    }

    // ─── Rider ───────────────────────────────────────────────────
    part def Rider {
        attribute name : ScalarValues::String;
        attribute mass : Mass;
    }

    // ─── Actions (Riding Behavior) ───────────────────────────────
    action def Ride {
        in item rider : Rider;
        in item bike : Bicycle;

        action mount;
        action pedal;
        action steer;
        action applyBrakes;
        action dismount;

        first mount;
        then pedal;
        then steer;
        then applyBrakes;
        then dismount;
    }

    // ─── Requirements ────────────────────────────────────────────
    requirement def WeightRequirement {
        doc /* The bicycle shall weigh no more than 12 kg. */
        subject bicycle : Bicycle;
        require constraint { bicycle.totalMass <= 12 [SI::kg] }
    }

    requirement def WheelSizeRequirement {
        doc /* Both wheels shall have a diameter of 700mm. */
        subject bicycle : Bicycle;
        require constraint { bicycle.frontWheel.diameter == 700 [SI::mm] }
        require constraint { bicycle.rearWheel.diameter == 700 [SI::mm] }
    }

    // ─── Sample Instance: Road Bike ──────────────────────────────
    part roadBike : Bicycle {
        attribute :>> bikeType = BikeType::road;
        attribute :>> totalMass = 9.5 [SI::kg];

        part :>> bikeFrame {
            attribute :>> material = FrameMaterial::carbon;
        }

        part :>> frontWheel {
            attribute :>> diameter = 700 [SI::mm];
        }

        part :>> rearWheel {
            attribute :>> diameter = 700 [SI::mm];
        }

        part :>> drivetrain {
            part :>> crankset {
                attribute :>> numberOfChainrings = 2;
            }
            part :>> cassette {
                attribute :>> numberOfSprockets = 11;
            }
        }
    }

    // ─── Verification ────────────────────────────────────────────
    verification def WeightTest {
        subject bicycle : Bicycle;
        objective {
            verify WeightRequirement;
        }
    }
}
