/**
 * A comprehensive SysML v2 warm-up text that exercises all major grammar
 * constructs.  Parsing this text pre-populates the ANTLR DFA cache so
 * that subsequent parses of real files are near-instant (~50 ms instead
 * of ~22 s).
 *
 * The text is intentionally compact — just enough variety to cover the
 * grammar's decision points, not a valid SysML model.
 */
export const WARMUP_TEXT = `
package WarmUp {
    public import ISQ::*;
    private import ScalarValues::*;
    public import Pkg::**;

    // ---- Part / Port / Item / Interface / Connection / Allocation ----
    part def Vehicle {
        attribute mass :> ISQ::mass;
        attribute name : String;
        attribute flags : Boolean;
        attribute count : Integer = 42;
        attribute ratio : Real default 3.14;
        attribute list :> ISQ::mass [*] nonunique ordered;
        ref item fuel : Fuel;
        port p1 : Port1;
        port p2 : ~Port1;

        perform action doSomething;
        exhibit state myStates parallel {
            state operatingStates {
                entry action initial;
                do doSomething;
                state off;
                state starting;
                state on { do doSomething; }
                transition initial then off;
                transition 'off-on' first off accept StartSig then on;
                transition on_off first on accept StopSig do send new OffSig() to ctrl then off;
            }
        }
        state healthStates {
            state normal;
            state degraded;
            transition initial then normal;
            transition norm_deg first normal accept when temp > Tmax then degraded;
            transition deg_norm first degraded accept ReturnNormal then normal;
        }

        constraint massConstraint { mass <= 2000 }
        assert constraint fuelCheck { fuel.fuelMass <= fuelMassMax }

        item :> envelopingShapes [1] : Box {
            length1 :>> length = 100;
        }
    }

    part def Engine {
        attribute mass :> ISQ::mass;
        attribute power :> ISQ::power;
        attribute cost : Real;
        attribute displacement :> ISQ::volume;
        attribute fuelEfficiency : Real;
        port ctrlPort : ~CtrlPort;
        port fuelIn : ~FuelPort;
        port driveOut : DrivePort;
        port flyWheel;
        part cylinders : Cylinder [4..6];
        part alternator { action generateElectricity; }
        perform action generateTorque;
        exhibit state engineStates {
            state off; state starting; state on { do generateTorque; }
        }
    }

    abstract part def Software;
    part def Controller :> Software {
        port controlPort : CtrlPort;
        exhibit state controllerStates parallel {
            state opStates {
                entry action initial;
                state off; state on;
                transition initial then off;
                transition 'off-on' first off accept StartSig then on;
                transition 'on-off' first on accept StopSig then off;
            }
        }
    }

    part def Sensor { port sensorPort : SensorPort; }
    part def Wheel { attribute diameter : Real; port lugPort : LugPort; }
    part def Hub { port shankPort : ShankPort; }
    part def HalfAxle { port shankComposite : ShankCompositePort {} }
    part def Axle { attribute mass :> ISQ::mass; }
    part def FrontAxle :> Axle { attribute steeringAngle :> ISQ::angularMeasure; }
    part def Driveshaft;
    part def Differential;
    part def AxleAssembly;
    part def Transmission { attribute gearRatio : Real; port clutch : ~DrivePort; exhibit state tStates; }
    part def FuelTank {
        attribute mass :> ISQ::mass;
        ref item fuel : Fuel { attribute :>> fuelMass; }
        attribute fuelKind : FuelKind;
        attribute fuelMassMax :> ISQ::mass;
        assert constraint fuelConstraint { fuel.fuelMass <= fuelMassMax }
        port fuelOut : FuelPort;
        port fuelIn : ~FuelPort;
    }
    part def Body { attribute color : Colors; }
    part def BodyAssy;
    part def Road { attribute incline : Real; attribute friction : Real; }
    part def Thermostat;
    part def Sunroof;
    part def StarterMotor { port gearPort : GearPort; }
    part def ElectricalGenerator;
    part def TorqueGenerator;
    part def SteeringSubsystem;
    part def BrakingSubsystem;
    part def Cylinder;

    // ---- Port definitions ----
    port def Port1 { in item cmd : Cmd; }
    port def CtrlPort;
    port def SensorPort;
    port def DrivePort { out torque : Torque; }
    port def FuelPort { out item fuel : Fuel; }
    port def FuelCmdPort :> Port1 { in item fuelCmd : FuelCmd redefines cmd; }
    port def GearPort;
    port def LugPort { attribute threadDia; attribute threadPitch; }
    port def ShankPort { attribute threadDia; attribute threadPitch; attribute shaftLength; }
    port def LugCompositePort { port lug : LugPort [*]; }
    port def ShankCompositePort { port shank : ShankPort [*]; }
    port def VehicleToRoadPort;
    port def SetSpeedPort;
    port def CruiseControlPort :> CtrlPort;
    port def SpeedSensorPort;
    port def DriverCmdPort { out item driverCmd : DriverCmd [*]; }
    port def HandPort :> DriverCmdPort {
        out item ignitionCmd : IgnCmd subsets driverCmd;
    }

    // ---- Item / Signal definitions ----
    item def Cmd;
    item def DriverCmd;
    item def IgnCmd :> DriverCmd { attribute onOff : OnOff; }
    item def FuelCmd :> Cmd;
    item def Fuel { attribute fuelMass :> ISQ::mass; }
    item def Torque;
    item def SensedSpeed { attribute speed :> ISQ::speed; }
    item def EngineStatus;
    attribute def StartSig;
    attribute def StopSig;
    attribute def OffSig;
    attribute def OverTemp;
    attribute def ReturnNormal;
    attribute def SetSpeed :> Real;
    attribute def VehicleOnSig;

    // ---- Interface definitions ----
    interface def DriveInterface {
        end p1 : DrivePort;
        end p2 : ~DrivePort;
        flow p1.torque to p2.torque;
    }
    interface def FuelInterface {
        end fuelOut : FuelPort;
        end fuelIn : ~FuelPort;
        flow of Fuel from fuelOut.fuel to fuelIn.fuel;
    }
    interface def WheelFastenerInterface {
        end lugPort : LugPort;
        end shankPort : ShankPort;
        attribute maxTorque : Torque;
        constraint { lugPort.threadDia == shankPort.threadDia }
    }
    interface def WheelHubInterface {
        end lugComposite : LugCompositePort;
        end shankComposite : ShankCompositePort;
        interface wfi : WheelFastenerInterface [5]
            connect lugComposite.lug to shankComposite.shank;
    }
    // ---- End feature syntax ----
    // Upstream grammar uses plain "end <name>" form only (no keyword after end).
    interface def EndFeatureTest {
        end ep1;
        end ep2 : DrivePort;
        end ep3;
    }
    connection def EndFeatureConnDef {
        end connEnd1;
        end connEnd2 : DrivePort;
    }

    // ---- Allocation ----
    allocation def LogicalToPhysical {
        end #logical logicalEnd;
        end #physical physicalEnd;
    }

    // ---- Enum definitions ----
    enum def Colors { black; grey; red; }
    enum def OnOff { on; off; }
    enum def FuelKind { gas; diesel; }
    enum def DiamChoices :> ISQ::LengthValue {
        enum = 60;
        enum = 80;
    }

    // ---- Attribute definitions ----
    attribute cylinderDia : DiamChoices = 80;
    alias Torque2 for ISQ::TorqueValue;

    // ---- Action definitions ----
    action def ProvidePower {
        in item cmd : Cmd;
        out wheelTorque : Torque [2];
    }
    action def GenerateTorque {
        in item fuelCmd : FuelCmd;
        out engineTorque : Torque;
    }
    action def AmplifyTorque { in engineTorque : Torque; out txTorque : Torque; }
    action def TransferTorque { in txTorque : Torque; out dsTorque : Torque; }
    action def DistributeTorque { in dsTorque : Torque; out wheelTorque : Torque [2]; }
    action def PerformSelfTest;
    action def ApplyParkingBrake;
    action def SenseTemperature { out temp :> ISQ::temperature; }

    // ---- State definitions ----
    state def VehicleStates;
    state def ControllerStates;

    // ---- Requirement definitions ----
    requirement def MassReq {
        doc /* mass shall be less than required */
        attribute massRequired :> ISQ::mass;
        attribute massActual :> ISQ::mass;
        require constraint { massActual <= massRequired }
    }
    requirement def ReliabilityReq {
        doc /* reliability shall be sufficient */
        attribute reliabilityRequired : Real;
        attribute reliabilityActual : Real;
        require constraint { reliabilityActual >= reliabilityRequired }
    }
    requirement def TorqueReq {
        doc /* engine shall generate torque */
        subject gt : GenerateTorque;
    }
    requirement def DriveOutputReq { doc /* engine shall provide drive */ }
    requirement def FuelReq {
        doc /* adequate fuel economy */
        attribute actualFE : Real;
        attribute requiredFE : Real;
        require constraint { actualFE >= requiredFE }
    }

    // ---- Individual definitions ----
    individual def VehicleContext_1;
    individual def Vehicle_1 :> Vehicle;
    individual def Wheel_1 :> Wheel;
    individual def Road_1 :> Road;

    // ---- Metadata definitions ----
    metadata def Safety { attribute isMandatory : Boolean; }
    metadata def Security;
    metadata def <fm> failureMode;
    metadata def <l> logical;
    metadata def <p> physical;

    // ---- Generic context ----
    part def Context {
        attribute time : Real;
    }

    // ---- Verification ----
    verification def MassTest;
    verification def AccelTest;

    // ---- Use cases ----
    use case def TransportPassenger {
        objective TransportObjective {
            doc /* deliver passenger safely */
        }
        subject vehicle : Vehicle;
        actor environment;
        actor road;
        actor driver;
        actor passenger [0..4];
        include use case getIn :> GetIn [1..5];
        include use case getOut :> GetOut [1..5];
    }
    use case def GetIn {
        subject vehicle : Vehicle;
        actor driver [0..1];
        actor passenger [0..1];
        assert constraint { driver != null xor passenger != null }
    }
    use case def GetOut {
        subject vehicle : Vehicle;
        actor driver [0..1];
        actor passenger [0..1];
        assert constraint { driver != null xor passenger != null }
    }

    // ---- Calc definitions ----
    calc def FuelConsumption {
        in bestFuel : Real;
        in idleFuel : Real;
        in tpd : Real;
        attribute f = bestFuel + idleFuel * tpd;
        return dpv : Real = 1 / f;
    }
    calc def AvgTravelTime { in scenario : Real; return tpd : Real; }
    calc def TraveledDist { in scenario : Real; return dist : Real; }
    calc def IdlingFuel { in engine : Engine; return fa : Real = engine.displacement * 0.5; }
    calc def BestFuel {
        in mass : Real; in bsfc : Real; in tpd : Real; in dist : Real;
        attribute pwr : Real;
        constraint { pwr == ((1 / 2) * mass * tpd**(-3)) / dist }
        return fb : Real = bsfc * 0.76 * pwr * tpd;
    }
    calc def ComputeBSFC { in engine : Engine; return : Real; }

    // ---- Concern / Viewpoint / View ----
    concern def VehicleSafety {
        doc /* identify safety features */
        subject;
        stakeholder se : SafetyEngineer;
    }
    part def SafetyEngineer;
    viewpoint def BehaviorViewpoint;
    viewpoint def SafetyViewpoint { frame concern vs : VehicleSafety; }
    view def TreeView { render asTreeDiagram; }
    view def NestedView;
    view def TableView;
    view def PartsTreeView :> TreeView { filter @SysML::PartUsage; }

    // ---- Trade study ----
    analysis def TradeStudy;

    // ---- Variation ----
    variation part def TxChoices :> Transmission {
        variant part txAuto;
        variant part txManual;
    }

    // ---- Vehicle Configuration (exercises deep nesting, connects, binds) ----
    package VehicleConfig {
        part vehicle_b : Vehicle {
            attribute redefines mass = dryMass + cargoMass + fuelTank.fuel.fuelMass;
            attribute dryMass redefines mass = 1500;
            attribute redefines count default 0;
            attribute partMasses = (fuelTank.mass, engine.mass);
            port fuelCmdPort : FuelCmdPort redefines p1 { in item fuelCmd redefines cmd; }
            port setSpeedPort : ~SetSpeedPort;
            port vehicleToRoadPort redefines p2 {
                port wheelToRoadPort1 : VehicleToRoadPort;
                port wheelToRoadPort2 : VehicleToRoadPort;
            }
            perform actionTree::providePower redefines doSomething;

            part fuelTank : FuelTank {
                attribute redefines mass = 75;
                ref item redefines fuel { attribute redefines fuelMass = 60; }
                attribute redefines fuelMassMax = 60;
            }
            part frontAxle : AxleAssembly {
                attribute mass :> ISQ::mass = 800;
                part axle : FrontAxle;
                part wheels : Wheel [2];
            }
            part rearAxle : AxleAssembly {
                attribute mass :> ISQ::mass = 875;
                attribute driveTrainEff : Real = 0.6;
                perform providePower.distributeTorque;
                part rearWheel1 : Wheel {
                    attribute redefines diameter;
                    port wheelToRoad : VehicleToRoadPort;
                    port lugPort :>> lugPort { port lug :>> lug [5]; }
                }
                part rearWheel2 : Wheel {
                    attribute redefines diameter;
                    port wheelToRoad : VehicleToRoadPort;
                }
                part differential : Differential {
                    port shaftD; port leftDiff; port rightDiff;
                }
                part rearAxlePart {
                    part leftHalf : HalfAxle;
                    part rightHalf : HalfAxle;
                }
                bind shaftD = differential.shaftD;
                connect differential.leftDiff to rearAxlePart.leftHalf.shankComposite;
                connect differential.rightDiff to rearAxlePart.rightHalf.shankComposite;
                interface wheelHub1 : WheelHubInterface
                    connect [1] rearWheel1.lugPort to [1] rearAxlePart.leftHalf.shankComposite;
                interface wheelHub2 : WheelHubInterface
                    connect [1] rearWheel2.lugPort to [1] rearAxlePart.rightHalf.shankComposite;
            }
            part starterMotor : StarterMotor;
            part engine : Engine {
                perform providePower.generateTorque redefines generateTorque;
                part cylinders : Cylinder [4..6];
                part alternator { action generateElectricity; }
                satisfy requirements::engineSpec by vehicle_b.engine {
                    requirement torqueReq :>> torqueReq { }
                    requirement driveReq :>> driveReq { }
                }
            }
            part transmission : Transmission {
                attribute mass :> ISQ::mass = 100;
                port shaftA;
                perform providePower.amplifyTorque;
            }
            part driveshaft : Driveshaft {
                attribute mass :> ISQ::mass = 100;
                port shaftB; port shaftC;
                perform providePower.transferTorque;
            }
            part sw : Controller {
                exhibit state controllerStates redefines controllerStates;
                part cruise : Sensor;
            }
            part speedSensor : Sensor;

            part bodyAssy : BodyAssy {
                part body : Body { attribute :>> color = Colors::red; }
                part bumper { @Safety { isMandatory = true; } }
                part keylessEntry { @Security; }
            }
            part interior {
                part alarm { @Security; }
                part seatBelt [2] { @Safety { isMandatory = true; } }
                part frontSeat [2];
                part airbag { @Safety { isMandatory = false; } }
            }

            // Connections and binds
            bind engine.fuelIn = fuelCmdPort;
            interface eTx : DriveInterface connect engine.driveOut to transmission.clutch;
            interface fuelIf : FuelInterface connect fuelTank.fuelOut to engine.fuelIn;
            allocate actionTree::providePower.genToAmp to eTx;
            bind engine.ctrlPort = p1;
            connect starterMotor.gearPort to engine.flyWheel;
            connect sw.controlPort to engine.ctrlPort;
            connect transmission.shaftA to driveshaft.shaftB;
            connect driveshaft.shaftC to rearAxle.shaftD;
            bind rearAxle.rearWheel1.wheelToRoad = vehicleToRoadPort.wheelToRoadPort1;
            bind rearAxle.rearWheel2.wheelToRoad = vehicleToRoadPort.wheelToRoadPort2;
            satisfy requirements::vehicleSpec by vehicle_b {
                requirement massReq :>> massReq { attribute redefines massActual = vehicle_b.mass; }
            }
        }
    }

    // ---- Action tree ----
    package actionTree {
        action providePower : ProvidePower {
            in item fuelCmd : FuelCmd redefines cmd;
            out wheelTorque redefines wheelTorque [2] = distributeTorque.wheelTorque;
            action generateTorque : GenerateTorque { in item = providePower.fuelCmd; }
            action amplifyTorque : AmplifyTorque;
            action transferTorque : TransferTorque;
            action distributeTorque : DistributeTorque;
            flow genToAmp from generateTorque.engineTorque to amplifyTorque.engineTorque;
            flow amplifyTorque.txTorque to transferTorque.txTorque;
            flow transferTorque.dsTorque to distributeTorque.dsTorque;
        }
        action performSelfTest : PerformSelfTest;
        action applyParkingBrake : ApplyParkingBrake;
        action senseTemperature : SenseTemperature;
    }

    // ---- Discrete interactions (messages, events, successions) ----
    package Interactions {
        part def Driver { port p1; port p2; }
        part part0 {
            perform action startVehicle {
                action turnOn send ignCmd via driver.p1 { in ignCmd : IgnCmd; }
                action trigger1 accept ignCmd : IgnCmd via vehicle.p1;
                flow of IgnCmd from trigger1.ignCmd to startEngine.ignCmd;
                action startEngine { in item ignCmd : IgnCmd; out item es : EngineStatus; }
                flow of EngineStatus from startEngine.es to sendStatus.es;
                action sendStatus send es via vehicle.p2 { in es : EngineStatus; }
                action trigger2 accept es : EngineStatus via driver.p2;
            }
            part driver : Driver {
                perform startVehicle.turnOn;
                perform startVehicle.trigger2;
                event occurrence driverReady;
            }
            part vehicle : Vehicle {
                perform startVehicle.trigger1;
                perform startVehicle.sendStatus;
                event occurrence doorClosed;
            }
            first vehicle.doorClosed then driver.driverReady;
            message of ignCmd : IgnCmd from driver.turnOn to vehicle.trigger1;
            message of es : EngineStatus from vehicle.sendStatus to driver.trigger2;
        }
    }

    // ---- Requirements (nested, with derivation) ----
    package requirements {
        item marketSurvey;
        dependency from vehicleSpec to marketSurvey;
        requirement vehicleSpec {
            subject vehicle : Vehicle;
            requirement <'1'> massReq : MassReq {
                doc /* total mass shall be within limits */
                attribute redefines massRequired = 2000;
                attribute redefines massActual default vehicle.mass;
                attribute fuelMassActual :> ISQ::mass;
                assume constraint { fuelMassActual == 60 }
            }
            allocate massReq to VehicleConfig::vehicle_b.mass;
            requirement <'2'> fuelReqs {
                doc /* fuel economy group */
                attribute assumedCargo :> ISQ::mass;
                requirement <'2_1'> cityFE : FuelReq {
                    redefines requiredFE = 10;
                    assume constraint { assumedCargo <= 500 }
                }
                requirement <'2_2'> hwyFE : FuelReq {
                    redefines requiredFE = 12.75;
                    assume constraint { assumedCargo <= 500 }
                }
            }
        }
        requirement engineSpec {
            subject engine1 : Engine;
            requirement <'1'> engineMassReq : MassReq {
                doc /* engine mass within limits */
                attribute redefines massRequired = 200;
                attribute redefines massActual = engine1.mass;
            }
            requirement torqueReq : TorqueReq {
                subject gt default engine1.generateTorque;
            }
            requirement driveReq : DriveOutputReq {
                port torqueOut { out torque : Torque; }
            }
        }
        #derivation connection {
            end #original ::> vehicleSpec.massReq;
            end #derive ::> engineSpec.engineMassReq;
        }
    }

    // ---- Analysis (calc, fuel economy) ----
    package vehicleAnalysis {
        analysis fuelEconomyAnalysis {
            subject = VehicleConfig::vehicle_b;
            objective fuelEconObj {
                doc /* estimate fuel economy */
                require requirements::vehicleSpec.fuelReqs;
            }
            in attribute scenario : Real;
            attribute dist = TraveledDist(scenario);
            attribute tpd = AvgTravelTime(scenario);
            attribute bsfc = ComputeBSFC(VehicleConfig::vehicle_b.engine);
            attribute fa = BestFuel(VehicleConfig::vehicle_b.mass, bsfc, tpd, dist);
            attribute fb = IdlingFuel(VehicleConfig::vehicle_b.engine);
            return attribute calcFE : Real = FuelConsumption(fa, fb, tpd);
        }
    }

    // ---- Trade-off analysis (variation, objective, evaluation) ----
    package tradeOff {
        analysis engineTradeOff : TradeStudy {
            subject vehicleAlts :> VehicleConfig::vehicle_b [2];
            part alt4cyl :> vehicleAlts {
                part engine redefines engine { part cylinders :>> cylinders [4]; attribute mass redefines mass = 180; }
            }
            part alt6cyl :> vehicleAlts {
                part engine redefines engine { part cylinders redefines cylinders [6]; attribute mass redefines mass = 220; }
            }
            objective;
            return part selected :> VehicleConfig::vehicle_b;
        }
    }

    // ---- Verification ----
    package vehicleVerification {
        verification massTests : MassTest {
            subject vehicle_uut :> VehicleConfig::vehicle_b;
            objective {
                verify requirements::vehicleSpec.massReq {
                    redefines massActual = weighVehicle.massMeasured;
                }
            }
            action weighVehicle { out massMeasured :> ISQ::mass; }
            then action evaluatePassFail {
                in massMeasured :> ISQ::mass;
                out verdict : Real;
            }
            flow from weighVehicle.massMeasured to evaluatePassFail.massMeasured;
            return :>> verdict = evaluatePassFail.verdict;
        }
        part verificationCtx {
            perform massTests;
            part vehicle_UUT :> VehicleConfig::vehicle_b;
            part massVerifSys {
                part scale { perform massTests.weighVehicle; }
                part operator { perform massTests.evaluatePassFail; }
            }
        }
    }

    // ---- Individuals (snapshots, timeslices) ----
    package vehicleIndividuals {
        individual a : VehicleContext_1 {
            timeslice t0_t2 {
                snapshot t0 {
                    attribute t0t redefines time = 0;
                    snapshot t0_r : Road_1 { :>> Road::incline = 0; :>> Road::friction = 0.1; }
                    snapshot t0_v : Vehicle_1 {
                        :>> Vehicle::mass = 1500;
                        :>> Vehicle::ratio = 0;
                    }
                }
                snapshot t1 {
                    attribute t1t redefines time = 1;
                    snapshot t1_r : Road_1 { :>> Road::incline = 0; :>> Road::friction = 0.1; }
                    snapshot t1_v : Vehicle_1 { :>> Vehicle::mass = 1500; }
                }
            }
        }
    }

    // ---- Use case scenario (forks, joins, successions) ----
    package missionScenario {
        use case transportPassenger : TransportPassenger {
            first start;
            then action a {
                action driverGetIn subsets getIn [1];
                action passengerGetIn subsets getIn [1];
            }
            then action trigger accept ignCmd : IgnCmd;
            then action b {
                action driveToDestination;
                action providePower;
            }
            then action c {
                action driverGetOut subsets getOut [1];
                action passengerGetOut subsets getOut [1];
            }
            then done;
        }
        use case transportPassenger_1 : TransportPassenger {
            action driverGetIn subsets getIn [1];
            action passengerGetIn subsets getIn [1];
            action driverGetOut subsets getOut [1];
            action passengerGetOut subsets getOut [1];
            action driveToDestination;
            action providePower;
            join join1; join join2; join join3;
            action trigger accept ignCmd : IgnCmd;
            first start; then fork fork1;
            then driverGetIn; then passengerGetIn;
            first driverGetIn then join1;
            first passengerGetIn then join1;
            first join1 then trigger;
            first trigger then fork2;
            fork fork2; then driveToDestination; then providePower;
            first driveToDestination then join2;
            first providePower then join2;
            first join2 then fork3;
            fork fork3; then driverGetOut; then passengerGetOut;
            first driverGetOut then join3;
            first passengerGetOut then join3;
            first join3 then done;
        }
    }

    // ---- Mission context with driver states ----
    package missionCtx {
        part def MissionDriver {
            port handPort : HandPort {}
            exhibit state driverStates {
                state initial; state wait;
                transition initial then wait;
                transition 'w-w-1' first wait
                    do send new IgnCmd(onOff=OnOff::on) via handPort then wait;
                transition 'w-w-2' first wait
                    do send new IgnCmd(onOff=OnOff::off) via handPort then wait;
            }
        }
        part def Passenger;
        part missionContext : Context {
            perform missionScenario::transportPassenger;
            part road : Road = missionScenario::transportPassenger.road;
            part driver : MissionDriver = missionScenario::transportPassenger.driver {
                perform missionScenario::transportPassenger.a.driverGetIn;
                perform missionScenario::transportPassenger.b.driveToDestination;
                perform missionScenario::transportPassenger.c.driverGetOut;
            }
            part passenger : Passenger = missionScenario::transportPassenger.passenger;
            part vehicle_b_1 :> VehicleConfig::vehicle_b = missionScenario::transportPassenger.vehicle {
                perform missionScenario::transportPassenger.b.providePower redefines doSomething;
                perform missionScenario::transportPassenger.trigger;
            }
            connect driver.handPort to vehicle_b_1.p1;
            connect road to vehicle_b_1.vehicleToRoadPort;
        }
    }

    // ---- Superset model (variation, selection constraint) ----
    package supersetModel {
        abstract part vehicleFamily {
            variation part engine : Engine {
                variant part engine4Cyl;
                variant part engine6Cyl;
            }
            part txChoices : TxChoices;
            part sunroof : Sunroof [0..1];
            assert constraint selectionConstraint {
                (engine == engine::engine4Cyl and txChoices == TxChoices::txManual) xor
                (engine == engine::engine6Cyl and txChoices == TxChoices::txAuto)
            }
            part driveshaft; part frontAxle; part rearAxle;
        }
    }

    // ---- Safety/security filter groups ----
    package filterGroups {
        public import VehicleConfig::vehicle_b::**;
        package SafetyGroup { public import vehicle_b::**; filter @Safety; }
        package SecurityGroup { public import vehicle_b::**; filter @Security; }
        package SafetyAndSecurity { public import vehicle_b::**; filter @Safety or @Security; }
        package MandatorySafety { public import vehicle_b::**; filter @Safety and Safety::isMandatory; }
    }

    // ---- Views ----
    package vehicleViews {
        view vehiclePartsTree_Safety : PartsTreeView {
            satisfy requirement sv : SafetyViewpoint;
            expose VehicleConfig::**;
            filter @Safety;
        }
    }

    // ---- Occurrence / CruiseControl (messages, events, redefines) ----
    occurrence CruiseControl {
        part vehicle_b :> VehicleConfig::vehicle_b {
            port redefines setSpeedPort { event occurrence setSpeedReceived; }
            part redefines speedSensor {
                port redefines sensorPort { event occurrence sensedSpeedSent; }
            }
            part redefines sw {
                part redefines cruise {
                    port redefines sensorPort { event occurrence sensedSpeedReceived; }
                }
            }
            part redefines engine {
                port redefines fuelIn { event occurrence fuelCmdReceived; }
            }
            message sendSensed of SensedSpeed
                from speedSensor.sensorPort.sensedSpeedSent
                to sw.cruise.sensorPort.sensedSpeedReceived;
            message sendFuelCmd of FuelCmd
                from sw.cruise.controlPort
                to engine.fuelIn.fuelCmdReceived;
        }
    }

    // ---- Allocation (logical to physical) ----
    package logicalAllocation {
        #logical part vehicleLogical : Vehicle {
            part torqueGen : TorqueGenerator { action generateTorque; }
            part elecGen : ElectricalGenerator { action generateElec; }
            part steeringSystem : SteeringSubsystem;
            part brakingSystem : BrakingSubsystem;
        }
        allocation vehicleL2P : LogicalToPhysical
            allocate vehicleLogical to VehicleConfig::vehicle_b {
                allocate vehicleLogical.torqueGen to VehicleConfig::vehicle_b.engine {
                    allocate vehicleLogical.torqueGen.generateTorque
                        to VehicleConfig::vehicle_b.engine.generateTorque;
                }
                allocate vehicleLogical.elecGen to VehicleConfig::vehicle_b.engine {
                    allocate vehicleLogical.elecGen.generateElec
                        to VehicleConfig::vehicle_b.engine.alternator.generateElectricity;
                }
            }
    }

    // ---- Engine variant with refinement ----
    package engine4CylVariant {
        part engine : Engine { part cylinders : Cylinder [4..8] ordered; }
        part engine4Cyl :> engine {
            part redefines cylinders [4];
            part cyl1 subsets cylinders [1];
            part cyl2 subsets cylinders [1];
            part cyl3 subsets cylinders [1];
            part cyl4 subsets cylinders [1];
        }
        #refinement dependency engine4Cyl to VehicleConfig::vehicle_b::engine;
    }

    // ---- Wheel hub assemblies (nested interfaces with explicit connections) ----
    package wheelHubAssy {
        part wheelHubAssy1 {
            part wheel1 : Wheel {
                port :>> lugPort : LugCompositePort { port lug :>> lug [5]; }
            }
            part hub1 : Hub {
                port :>> shankPort : ShankCompositePort { port shank :>> shank [5]; }
            }
            interface wheelHub : WheelHubInterface
                connect [1] wheel1.lugPort to [1] hub1.shankPort;
        }
        part wheelHubAssy2 {
            part wheel1 : Wheel {
                port :>> lugPort : LugCompositePort { port lug :>> lug [5]; }
            }
            part hub1 : Hub {
                port :>> shankPort : ShankCompositePort {
                    port shank :>> shank [5] {
                        attribute :>> threadDia = 14;
                        attribute :>> threadPitch = 1.5;
                        attribute :>> shaftLength = 70;
                    }
                }
            }
            interface wheelHub : WheelHubInterface
                connect [1] lugComposite ::> wheel1.lugPort
                to [1] shankComposite ::> hub1.shankPort {
                    interface wf1 :> wfi
                        connect lugPort ::> lugComposite.lug
                        to shankPort ::> shankComposite.shank {
                            attribute :>> maxTorque = 90 * 1.356;
                        }
                }
        }
    }

    // ==== ADDITIONAL DFA WARM-UP — EXPRESSION & TYPING COVERAGE ====

    // ---- Unit/bracket expressions (exercises ownedExpression LBRACK alt) ----
    package unitExprs {
        attribute len1 : Real = 4800 [mm];
        attribute spd1 : Real = 1.96 [m / s**2];
        attribute area1 : Real = 90 * 1.356 [N * m];
        attribute pos3d = (0, 0, 0) [spatialCF];
        attribute mixed = 2.5 * (a + b) [kg / m**3];
    }

    // ---- Trigger variants (accept at, accept via, complex guard) ----
    package triggerPatterns {
        state def TriggerStates {
            state idle;
            state active;
            state off2;
            transition t_at first idle accept at maintenanceTime then active;
            transition t_via first active accept cmd : Cmd via ctrlPort then off2;
            transition t_guard first idle
                accept ignCmd : IgnCmd via p1
                if (ignCmd.onOff == OnOff::on and flags)
                do send new StartSig() to ctrl
                then active;
        }
    }

    // ---- META expression & semantic metadata ----
    package metaExprs {
        state fmodes [*] nonunique;
        metadata def FailInfo {
            :>> baseType = fmodes meta SysML::StateUsage;
        }
    }

    // ---- Deeply nested redefines chains (4–5 levels) ----
    package deepRedefines {
        occurrence def DeepRedef {
            part v :> VehicleConfig::vehicle_b {
                part redefines sw {
                    part redefines cruise {
                        port redefines sensorPort {
                            event occurrence sensedRx;
                        }
                    }
                }
                part redefines engine {
                    port redefines fuelIn {
                        event occurrence fuelRx;
                    }
                }
            }
        }
    }

    // ---- Event occurrence with .sourceEvent/.targetEvent ----
    package eventPatterns {
        occurrence def MsgPattern {
            part sender { port sp; event occurrence eSent; }
            part receiver { port rp; event occurrence eRcvd; }
            message msg1 of Cmd from sender.sp.eSent to receiver.rp.eRcvd;
            first sender.eSent then receiver.eRcvd;
        }
    }

    // ---- Quantity types & derived units ----
    package quantityTypes {
        attribute dpv :> scalarQuantities = distance / volume;
        attribute tpd :> scalarQuantities = time / distance;
        attribute unitKpl : DerivedUnit = km / L;
        attribute unitRpm : DerivedUnit = 1 / SI::min;
    }

    // ---- Rich metadata annotations ----
    package richMetadata {
        @Rationale about engineTradeOff {
            text = "engine4cyl selected based on trade study";
        }
        @Risk about vehicleSafety {
            totalRisk = medium;
            technicalRisk = medium;
            scheduleRisk = medium;
            costRisk = low;
        }
        @StatusInfo {
            status = StatusKind::closed;
            originator = "Alice";
            owner = "Bob";
        }
        @VerificationMethod {
            kind = (VerificationMethodKind::test, VerificationMethodKind::analyze);
        }
    }

    // ---- Nested invocation & PassIf pattern ----
    package nestedInvocations {
        verification def MassTest {
            subject uut : Vehicle;
            actor verifier = verCtx.massSys;
            objective {
                verify requirements::vehicleSpec.massReq {
                    redefines massActual = weigh.measured;
                }
            }
            action weigh { out measured :> ISQ::mass; }
            then action eval {
                in measured :> ISQ::mass;
                out verdict = PassIf(requirements::vehicleSpec.massReq(uut));
            }
            flow from weigh.measured to eval.measured;
            return :>> verdict = eval.verdict;
        }
    }

    // ---- Calc with :> subsetting (evaluationFunction pattern) ----
    package calcPatterns {
        calc :> evaluationFunction {
            in part v :> alt4cyl;
            return attribute ev : Real = EvalFunc(v.engine.mass, v.engine.power);
        }
    }

    // ---- Redefines with sum() and complex value expressions ----
    package sumPatterns {
        part cfgPart : Vehicle {
            attribute dryMass redefines mass = sum(partMasses);
            attribute partMasses = (fuelTank.mass, engine.mass, rearAxle.mass);
            attribute avgFE :> distancePerVolume;
        }
    }

    // ---- Nested variation within variant ----
    package nestedVariation {
        variation part engineChoices : Engine {
            variant part eng4;
            variant part eng6 {
                part cyl : Cylinder [6] {
                    variation attribute dia : Real {
                        variant attribute smallDia;
                        variant attribute largeDia;
                    }
                }
            }
        }
    }

    // ---- Objective with typing, semicolon body ----
    package tradeStudyPatterns {
        analysis tradeA : TradeStudy {
            subject alts :> VehicleConfig::vehicle_b [2];
            objective : MaximizeObjective;
            return part sel :> VehicleConfig::vehicle_b;
        }
    }

    // ---- Prefix metadata on attributes (#mop, #moe) ----
    package prefixMetadata {
        part monitoredPart {
            #mop attribute trackedMass :> ISQ::mass;
            #moe attribute trackedTime :> ISQ::time;
        }
    }

    // ---- Complex feature chains (4+ segments, qualified names) ----
    package featureChains {
        bind cruiseCtrl.speedPort.value = speedSensor.outputPort.signalValue;
        bind engine.fuelPort.fuelType = fuelSys.supply.fuelPort.fuelType;
        connect [1] chassis.frontAxle.leftWheel.hubPort
            to [1] brakeSys.frontLeft.caliper.mountPort;
    }

    // ---- Conditional / ternary / null-coalesce expressions ----
    package exprCoverage {
        attribute ternary = a > b ? a : b;
        attribute coalesce = maybeNull ?? defaultVal;
        attribute implies = p implies q;
        attribute bitwise = flags & mask | shifted ^ inverted;
        attribute range = 1..10;
        attribute cast = x as Integer;
        attribute isinstance = y istype Real;
        attribute hastype = z hastype String;
        attribute select = items.>filter(x | x > 0);
        attribute collect = items->collect(x | x.name);
        attribute all = all v : Vehicle {| v.mass > 0 |};
    }

    // ---- Assignment actions ----
    package assignActions {
        action doAssign {
            attribute x : Integer = 0;
            assign x := x + 1;
            assign x := if x > 10 ? 0 : x;
        }
    }

    // ---- Bare item usages & defined by ----
    // These constructs must be in the warmup text to ensure the DFA
    // snapshot covers their token transitions.
    part def DefinedByPart {
        item myItem;
        item namedItem : ItemType;
        part sub defined by SubDef, AltDef;
        part multi : TypeA, TypeB;
    }
    item def ItemType;
    part def SubDef;
    part def AltDef;
    part def TypeA;
    part def TypeB;

    // ---- Flow / streaming / succession ----
    // The 'flow of X from Y to Z' construct exercises item-flow grammar rules.
    part def FlowSource { out item outPort : Signal; }
    part def FlowSink   { in  item inPort  : Signal; }
    item def Signal;
    action def Focus  { out xrsl : Signal; }
    action def Shoot  { in  xsf  : Signal; }
    action takePicture {
        action focus : Focus [1];
        flow of Signal from focus.xrsl to shoot.xsf;
        action shoot : Shoot [1];
    }
    part flowExample {
        part src : FlowSource;
        part snk : FlowSink;
        flow of Signal from src.outPort to snk.inPort;
        stream of Signal from src.outPort to snk.inPort;
    }
    succession first start then doA;
    succession doA then doB;

}
`;
