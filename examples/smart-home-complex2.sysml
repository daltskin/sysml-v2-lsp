package SmartHomeModel {
    // Smart Home System Model — comprehensive SysML v2 example
    public import Definitions::*;
    public import ISQ::*;
    package Definitions {
        public import PartDefinitions::*;
        public import PortDefinitions::*;
        public import ItemDefinitions::*;
        public import SignalDefinitions::*;
        public import InterfaceDefinitions::*;
        public import AllocationDefinitions::*;
        public import ActionDefinitions::*;
        public import StateDefinitions::*;
        public import RequirementDefinitions::*;
        public import AttributeDefinitions::*;
        public import IndividualDefinitions::*;
        public import MetadataDefinitions::**;
        public import KeyWord_MetadataDefinitions::*;
        package PartDefinitions {
            part def SmartHome {
                attribute totalPower :> ISQ::power;
                attribute floorArea :> ISQ::area;
                attribute occupancy : ScalarValues::Integer;
                attribute indoorTemp :> ISQ::temperature;
                attribute outdoorTemp :> ISQ::temperature;
                attribute Tmax :> ISQ::temperature;
                attribute Tmin :> ISQ::temperature;
                attribute maintenanceTime : Time::DateTime;
                attribute motionDetected : ScalarValues::Boolean;
                port commandPort : CommandPort;
                port statusPort : StatusPort;
                port powerSupplyPort : PowerSupplyPort;
                port networkPort : NetworkPort;
                perform action regulateClimate;
                perform action manageLighting;
                perform action monitorSecurity;
                perform action manageEnergy;
                perform action performDiagnostics;
                perform action senseTemperature;
                exhibit state homeStates parallel {
                    ref controller : HomeController;
                    state operatingStates {
                        entry action initial;
                        state standby;
                        state occupied;
                        state away {
                            entry monitorSecurity;
                            do manageEnergy;
                        }
                        state nightMode {
                            entry manageLighting;
                            do regulateClimate;
                            exit performDiagnostics;
                            constraint { totalPower <= 2000 [W] }
                        }

                        transition initial then standby;

                        transition standby_To_occupied
                            first standby
                            accept cmd : OccupantCommand via commandPort
                                if cmd.commandType == CommandType::arrive and motionDetected
                            do send new OccupancyDetectedSignal() to controller
                            then occupied;

                        transition occupied_To_away
                            first occupied
                            accept cmd : OccupantCommand via commandPort
                                if cmd.commandType == CommandType::depart
                            do send new DepartureSignal() to controller
                            then away;

                        transition away_To_occupied
                            first away
                            accept OccupancyDetectedSignal
                            then occupied;

                        transition occupied_To_nightMode
                            first occupied
                            accept NightModeSignal
                            then nightMode;

                        transition nightMode_To_occupied
                            first nightMode
                            accept DawnSignal
                            then occupied;
                    }

                    state thermalStates {
                        entry action initial;
                        do senseTemperature {
                            out temp;
                        }

                        state comfortable;
                        state tooCold;
                        state tooHot;

                        transition initial then comfortable;

                        transition comfortable_To_tooCold
                            first comfortable
                            accept when senseTemperature.temp < Tmin
                            do send new HeatingRequired() to controller
                            then tooCold;

                        transition comfortable_To_tooHot
                            first comfortable
                            accept when senseTemperature.temp > Tmax
                            do send new CoolingRequired() to controller
                            then tooHot;

                        transition tooCold_To_comfortable
                            first tooCold
                            accept TemperatureNormal
                            then comfortable;

                        transition tooHot_To_comfortable
                            first tooHot
                            accept TemperatureNormal
                            then comfortable;
                    }
                }
            }
            part def Room {
                attribute roomArea :> ISQ::area;
                attribute roomTemp :> ISQ::temperature;
                attribute luminance :> ISQ::luminousIntensity;
                port roomDataPort : RoomDataPort;
                port lightControlPort : LightControlPort;
                port hvacPort : HVACPort;
            }
            part def LivingRoom :> Room;
            part def Bedroom :> Room;
            part def Kitchen :> Room {
                attribute gasDetected : ScalarValues::Boolean;
                port gasAlarmPort : AlarmPort;
            }
            part def Bathroom :> Room {
                attribute humidityLevel : ScalarValues::Real;
            }
            part def Garage {
                attribute doorOpen : ScalarValues::Boolean;
                port garageDoorPort : GarageDoorPort;
            }
            part def HVACSystem {
                attribute mass :> ISQ::mass;
                attribute coolingCapacity :> ISQ::power;
                attribute heatingCapacity :> ISQ::power;
                attribute energyEfficiencyRatio : ScalarValues::Real;
                attribute cost : ScalarValues::Real;
                port controlPort : ~ControlPort;
                port airSupplyPort : AirSupplyPort;
                port powerInPort : ~PowerSupplyPort;
                port thermostatPort : ThermostatPort;
                perform action regulateTemperature;
                exhibit state hvacStates {
                    state off;
                    state heating;
                    state cooling;
                    state ventilating {
                        do regulateTemperature;
                    }
                }
            }
            part def HeatPumpSystem :> HVACSystem;
            part def CentralAirSystem :> HVACSystem;
            part def MiniSplitSystem :> HVACSystem;
            part def Thermostat {
                attribute setpoint :> ISQ::temperature;
                port sensorPort : TemperatureSensorPort;
                port commandPort : ThermostatPort;
            }
            part def LightingSystem {
                attribute totalLumens :> ISQ::luminousFlux;
                port controlPort : LightControlPort;
                port powerInPort : ~PowerSupplyPort;
            }
            part def SmartLight {
                attribute brightness : ScalarValues::Real;
                attribute colorTemp : ScalarValues::Integer;
                port dimmerPort : DimmerPort;
            }
            part def SecuritySystem {
                attribute armed : ScalarValues::Boolean;
                port alarmPort : AlarmPort;
                port cameraPort : CameraPort;
                port sensorPort : MotionSensorPort;
                port controlPort : ~ControlPort;
                exhibit state securityStates {
                    state disarmed;
                    state armedHome;
                    state armedAway;
                    state triggered;
                }
            }
            part def MotionSensor {
                port detectionPort : MotionSensorPort;
            }
            part def DoorSensor {
                attribute doorClosed : ScalarValues::Boolean;
                port statusPort : DoorSensorPort;
            }
            part def SecurityCamera {
                attribute resolution : ScalarValues::Integer;
                port videoPort : CameraPort;
            }
            part def SmokeDetector {
                port alarmPort : AlarmPort;
            }
            part def EnergyManagementSystem {
                attribute gridPower :> ISQ::power;
                attribute solarPower :> ISQ::power;
                attribute batteryLevel : ScalarValues::Real;
                port gridPort : PowerSupplyPort;
                port solarPort : PowerSupplyPort;
                port batteryPort : BatteryPort;
                port loadPort : ~PowerSupplyPort;
                perform action optimizeEnergy;
            }
            part def SolarPanel {
                attribute peakOutput :> ISQ::power;
                attribute panelArea :> ISQ::area;
                port powerOutPort : PowerSupplyPort;
            }
            part def BatteryStorage {
                attribute capacity :> ISQ::energy;
                attribute chargeLevel : ScalarValues::Real;
                port chargePort : BatteryPort;
            }
            part def HomeController :> Software {
                port controlPort : ControlPort;
                exhibit state controllerStates parallel {
                    state operatingStates {
                        entry action initial;
                        state idle;
                        state active;
                        transition initial then idle;
                        transition 'idle-active'
                            first idle
                            accept OccupancyDetectedSignal
                            then active;
                        transition 'active-idle'
                            first active
                            accept DepartureSignal
                            then idle;
                    }
                }
            }
            abstract part def Software;
            part def HomeSoftware :> Software;
            part def AutomationEngine :> Software {
                port rulePort : ~ControlPort;
                port sensorDataPort : ~RoomDataPort;
                exhibit state automationStates;
            }
            part def NetworkHub {
                attribute bandwidth : ScalarValues::Real;
                port uplinkPort : NetworkPort;
                port devicePorts : NetworkPort [*];
            }
            part def SmartSpeaker {
                port commandPort : CommandPort;
                port networkPort : NetworkPort;
            }
            part def WaterHeater {
                attribute tankCapacity :> ISQ::volume;
                attribute heatingPower :> ISQ::power;
                port powerInPort : ~PowerSupplyPort;
            }
            part def SmartLock {
                attribute locked : ScalarValues::Boolean;
                port lockPort : LockPort;
                port networkPort : NetworkPort;
            }
            part def Appliance {
                attribute standbyPower :> ISQ::power;
                attribute activePower :> ISQ::power;
            }
            // logical components
            part def ClimateController;
            part def LightingController;
            part def SecurityController;
            part def EnergyOptimizer;
        }
        package PortDefinitions {
            port def CommandPort {
                in item command : OccupantCommand;
            }
            port def StatusPort;
            port def PowerSupplyPort {
                out power :> ISQ::power;
            }
            port def NetworkPort;
            port def ControlPort;
            port def RoomDataPort {
                out item roomData : RoomData;
            }
            port def LightControlPort {
                in item lightCmd : LightCommand;
            }
            port def HVACPort {
                in airflow :> ISQ::volumeFlowRate;
            }
            port def AirSupplyPort {
                out airflow :> ISQ::volumeFlowRate;
            }
            port def ThermostatPort {
                out setpoint :> ISQ::temperature;
            }
            port def TemperatureSensorPort {
                out temperature :> ISQ::temperature;
            }
            port def AlarmPort {
                out item alarm : AlarmEvent;
            }
            port def CameraPort {
                out item videoFeed : VideoStream;
            }
            port def MotionSensorPort {
                out item detection : MotionEvent;
            }
            port def DoorSensorPort {
                out item doorStatus : DoorEvent;
            }
            port def DimmerPort {
                in brightness : ScalarValues::Real;
            }
            port def BatteryPort {
                in chargePower :> ISQ::power;
                out dischargePower :> ISQ::power;
            }
            port def GarageDoorPort {
                in item garageDoorCmd : GarageDoorCommand;
            }
            port def LockPort {
                in item lockCmd : LockCommand;
            }
            port def SensorCompositePort {
                port tempSensor : TemperatureSensorPort [*];
                port motionSensor : MotionSensorPort [*];
            }
            port def ActuatorCompositePort {
                port lightControl : LightControlPort [*];
                port hvacControl : HVACPort [*];
            }
        }
        package ItemDefinitions {
            item def OccupantCommand {
                attribute commandType : CommandType;
            }
            item def LightCommand {
                attribute targetBrightness : ScalarValues::Real;
                attribute targetColorTemp : ScalarValues::Integer;
            }
            item def RoomData {
                attribute temperature :> ISQ::temperature;
                attribute humidity : ScalarValues::Real;
                attribute lightLevel :> ISQ::luminousIntensity;
                attribute occupied : ScalarValues::Boolean;
            }
            item def AlarmEvent {
                attribute severity : AlarmSeverity;
            }
            item def VideoStream;
            item def MotionEvent {
                attribute confidence : ScalarValues::Real;
            }
            item def DoorEvent {
                attribute doorClosed : ScalarValues::Boolean;
            }
            item def GarageDoorCommand;
            item def LockCommand {
                attribute lockAction : LockAction;
            }
            item def EnergyReport {
                attribute totalConsumption :> ISQ::energy;
                attribute solarGeneration :> ISQ::energy;
                attribute gridUsage :> ISQ::energy;
            }
        }
        package SignalDefinitions {
            item def Cmd;
            item def OccupantCmd;
            item def SecurityCmd :> OccupantCmd {
                attribute armMode : SecurityArmMode;
            }
            item def SystemStatus;

            attribute def OccupancyDetectedSignal;
            attribute def DepartureSignal;
            attribute def NightModeSignal;
            attribute def DawnSignal;
            attribute def HeatingRequired;
            attribute def CoolingRequired;
            attribute def TemperatureNormal;
            attribute def IntrusionDetectedSignal;
            attribute def SmokeDetectedSignal;
            attribute def PowerOutageSignal;
            attribute def LowBatterySignal;
            attribute def SetTemperature :> ScalarValues::Real;
        }
        package InterfaceDefinitions {
            interface def HVACToRoomInterface {
                end supply : AirSupplyPort;
                end intake : ~AirSupplyPort;
                flow supply.airflow to intake.airflow;
            }
            interface def SensorToControllerInterface {
                end sensorPort : RoomDataPort;
                end controllerPort : ~RoomDataPort;
                flow of RoomData from sensorPort.roomData to controllerPort.roomData;
            }
            interface def PowerInterface {
                end powerOut : PowerSupplyPort;
                end powerIn : ~PowerSupplyPort;
                flow powerOut.power to powerIn.power;
            }
            interface def LightToControlInterface {
                end controlPort : LightControlPort;
                end dimmerPort : ~LightControlPort;
            }
            interface def SensorBusInterface {
                end sensorComposite : SensorCompositePort;
                end actuatorComposite : ActuatorCompositePort;
                interface sensorLink : SensorToControllerInterface [*]
                    connect sensorComposite.tempSensor to actuatorComposite.hvacControl;
            }
        }
        package AllocationDefinitions {
            allocation def LogicalToPhysical {
                end #logical logicalEnd;
                end #physical physicalEnd;
            }
        }
        package ActionDefinitions {
            action def RegulateClimate {
                in item thermostatCmd : OccupantCommand;
                out airflowRate :> ISQ::volumeFlowRate [*];
            }
            action def SenseTemperature {
                out temp :> ISQ::TemperatureValue;
            }
            action def HeatRoom {
                in setpoint :> ISQ::temperature;
                out heatedAir :> ISQ::volumeFlowRate;
            }
            action def CoolRoom {
                in setpoint :> ISQ::temperature;
                out cooledAir :> ISQ::volumeFlowRate;
            }
            action def DistributeAir {
                in conditionedAir :> ISQ::volumeFlowRate;
                out roomAirflow :> ISQ::volumeFlowRate [*];
            }
            action def ManageLighting {
                in item lightCmd : LightCommand;
                out brightness : ScalarValues::Real [*];
            }
            action def MonitorSecurity {
                out item alert : AlarmEvent;
            }
            action def OptimizeEnergy {
                in gridPower :> ISQ::power;
                in solarPower :> ISQ::power;
                out loadAllocation :> ISQ::power [*];
            }
            action def PerformDiagnostics;
            action def ArmSecurity;
            action def DisarmSecurity;
        }
        package StateDefinitions {
            state def HomeStates;
            state def HVACStates;
            state def SecurityStates;
            state def LightingStates;
        }
        package RequirementDefinitions {
            requirement def EnergyRequirement {
                doc /* The actual energy consumption shall be less than the required budget */
                attribute energyBudget :> ISQ::power;
                attribute energyActual :> ISQ::power;
                require constraint { energyActual <= energyBudget }
            }
            requirement def ComfortRequirement {
                doc /* Indoor temperature shall remain within the comfort range */
                attribute tempMin :> ISQ::temperature;
                attribute tempMax :> ISQ::temperature;
                attribute tempActual :> ISQ::temperature;
                require constraint { tempActual >= tempMin and tempActual <= tempMax }
            }
            requirement def SecurityRequirement {
                doc /* The security system shall detect intrusion within the required response time */
                attribute responseTimeRequired :> ISQ::time;
                attribute responseTimeActual :> ISQ::time;
                require constraint { responseTimeActual <= responseTimeRequired }
            }
            requirement def ReliabilityRequirement {
                doc /* The actual reliability shall be greater than the required reliability */
                attribute reliabilityRequired : ScalarValues::Real;
                attribute reliabilityActual : ScalarValues::Real;
                require constraint { reliabilityActual >= reliabilityRequired }
            }
            requirement def HVACEfficiencyRequirement {
                doc /* The HVAC system shall maintain efficiency above the minimum required */
                subject hvacSystem : HVACSystem;
            }
            requirement def SafetyRequirement {
                doc /* All safety-critical systems shall respond within the required time */
                attribute maxResponseTime :> ISQ::time;
            }
        }
        package AttributeDefinitions {
            public import ScalarValues::*;
            public import Quantities::*;
            public import MeasurementReferences::DerivedUnit;
            public import SIPrefixes::kilo;
            public import NumericalFunctions::*;
            public import SI::*;
            alias EnergyRate for ISQ::PowerValue;

            enum def CommandType { arrive; depart; setTemp; setLight; arm; disarm; }
            enum def AlarmSeverity { info; warning; critical; }
            enum def SecurityArmMode { home; away; night; }
            enum def LockAction { lock; unlock; }
            enum def LightMode { off; dim; normal; bright; }
            enum def HVACMode { off; heat; cool; auto; fan; }
            enum def OccupancyLevel { empty; low; medium; high; }
            enum def EnergySource { grid; solar; battery; }

            energyPerArea :> scalarQuantities = energy / area;
            powerPerArea :> scalarQuantities = power / area;

            kWh : DerivedUnit = kilo * W * h;
            lux : DerivedUnit = lm / m**2;
        }
        package IndividualDefinitions {
            individual def HomeContext_1 :> GenericContext::Context;
            individual def SmartHome_1 :> SmartHome;
            individual def LivingRoom_1 :> LivingRoom;
            individual def Bedroom_1 :> Bedroom;
            individual def Kitchen_1 :> Kitchen;
            individual def HVACSystem_1 :> HVACSystem;
            individual def SecuritySystem_1 :> SecuritySystem;
            individual def SolarPanel_1 :> SolarPanel;
        }
        package MetadataDefinitions {
            public import AnalysisTooling::*;
            metadata def Safety {
                attribute isMandatory : ScalarValues::Boolean;
            }
            metadata def Privacy;
            metadata def EnergyRating {
                attribute rating : ScalarValues::Integer;
            }
        }
        package KeyWord_MetadataDefinitions {
            public import Metaobjects::SemanticMetadata;

            // define the keyword failureMode for smart home components
            state failureModes [*] nonunique;

            metadata def <fm> failureMode :> SemanticMetadata {
                :>> baseType = failureModes meta SysML::StateUsage;
            }

            occurrence logicalOccurrences [*] nonunique;

            metadata def <l> logical :> SemanticMetadata {
                :>> baseType = logicalOccurrences meta SysML::Usage;
            }

            occurrence physicalOccurrences [*] nonunique;

            metadata def <p> physical :> SemanticMetadata {
                :>> baseType = physicalOccurrences meta SysML::Usage;
            }
        }
        package GenericContext {
            part def Context {
                attribute time : ISQ::TimeValue;
                attribute spatialCF : CartesianSpatial3dCoordinateFrame [1] { :>> mRefs = (m, m, m); }
            }
        }
    }

    package HomeLogicalConfiguration {
        package PartsTree {
            #logical part homeLogical : SmartHome {
                part climateController : ClimateController {
                    action regulateTemperature;
                }
                part lightingController : LightingController {
                    action adjustLighting;
                }
                part securityController : SecurityController {
                    action monitorPerimeter;
                }
                part energyOptimizer : EnergyOptimizer {
                    action optimizePowerUsage;
                }
            }
        }
    }
    package HomeLogicalToPhysicalAllocation {
        public import HomeConfigurations::HomeConfiguration_b::PartsTree::**;
        public import HomeLogicalConfiguration::PartsTree::*;

        allocation homeLogicalToPhysicalAllocation : LogicalToPhysical
            allocate homeLogical to home_b {
                allocate homeLogical.climateController to home_b.hvacSystem {
                    allocate homeLogical.climateController.regulateTemperature to home_b.hvacSystem.regulateTemperature;
                }
                allocate homeLogical.securityController to home_b.securitySystem {
                    allocate homeLogical.securityController.monitorPerimeter to home_b.securitySystem.monitorPerimeter;
                }
            }
    }
    package HomeConfigurations {
        package HomeConfiguration_a {
            package PartsTree {
                part home_a : SmartHome {
                    attribute totalPower redefines SmartHome::totalPower = sum(subsystemPower);
                    attribute subsystemPower [*] nonunique :> ISQ::power;
                    attribute redefines SmartHome::occupancy = 0;

                    part livingRoom : LivingRoom {
                        attribute redefines roomArea = 35 [m**2];
                        part ceilingLight : SmartLight;
                        part motionSensor : MotionSensor;
                    }
                    part bedroom1 : Bedroom {
                        attribute redefines roomArea = 20 [m**2];
                        part bedsideLight : SmartLight;
                    }
                    part kitchen : Kitchen {
                        attribute redefines roomArea = 15 [m**2];
                        part smokeDetector : SmokeDetector;
                    }
                    part hvacSystem : HVACSystem {
                        attribute redefines mass = 80 [kg];
                    }
                }
            }
            package ActionTree {
            }
            package Requirements {
            }
        }
        package HomeConfiguration_b {
            public import ShapeItems::Box;
            public import ParametersOfInterestMetadata::mop;
            public import ModelingMetadata::*;

            package PartsTree {
                part home_b : SmartHome {
                    #mop attribute totalPower redefines totalPower = sum(subsystemPower);
                    attribute subsystemPower = (
                        hvacSystem.heatingCapacity,
                        lightingSystem.totalLumens,
                        energyMgmt.gridPower
                    );
                    attribute redefines occupancy default 0;
                    attribute avgEnergyConsumption :> powerPerArea;
                    port commandPort redefines commandPort {
                        in item command redefines command;
                    }
                    port networkPort redefines networkPort;
                    port statusPort redefines statusPort {
                        port roomStatus1 : RoomDataPort;
                        port roomStatus2 : RoomDataPort;
                    }
                    perform ActionTree::regulateClimate redefines regulateClimate;
                    perform ActionTree::performDiagnostics redefines performDiagnostics;
                    perform ActionTree::senseTemperature redefines senseTemperature;
                    exhibit state homeStates redefines homeStates;

                    // enveloping shape for the home footprint
                    item :> envelopingShapes : Box [1] {
                        length1 :>> length = 15000 [mm];
                        width1 :>> width = 12000 [mm];
                        height1 :>> height = 3000 [mm];
                    }

                    part livingRoom : LivingRoom {
                        attribute redefines roomArea = 40 [m**2];
                        port roomDataPort redefines roomDataPort;
                        part ceilingLight : SmartLight {
                            attribute redefines brightness = 0.8;
                            attribute redefines colorTemp = 4000;
                            port dimmerPort redefines dimmerPort;
                        }
                        part floorLamp : SmartLight {
                            attribute redefines brightness = 0.5;
                        }
                        part motionSensor1 : MotionSensor;
                        part tempSensor1 : Thermostat {
                            attribute redefines setpoint = 22 [K];
                        }
                        part doorSensor1 : DoorSensor;
                        part smartSpeaker1 : SmartSpeaker;
                    }
                    part bedroom1 : Bedroom {
                        attribute redefines roomArea = 22 [m**2];
                        port roomDataPort redefines roomDataPort;
                        part bedsideLight1 : SmartLight {
                            attribute redefines brightness;
                            port dimmerPort redefines dimmerPort;
                        }
                        part bedsideLight2 : SmartLight {
                            attribute redefines brightness;
                            port dimmerPort redefines dimmerPort;
                        }
                        part motionSensor2 : MotionSensor;
                        part tempSensor2 : Thermostat;
                    }
                    part bedroom2 : Bedroom {
                        attribute redefines roomArea = 18 [m**2];
                        part ceilingLight : SmartLight;
                        part motionSensor3 : MotionSensor;
                    }
                    part kitchen : Kitchen {
                        attribute redefines roomArea = 18 [m**2];
                        attribute redefines gasDetected = false;
                        port gasAlarmPort redefines gasAlarmPort;
                        part smokeDetector : SmokeDetector { @Safety { isMandatory = true; } }
                        part motionSensor4 : MotionSensor;
                        part kitchenLight : SmartLight;
                    }
                    part bathroom : Bathroom {
                        attribute redefines roomArea = 8 [m**2];
                        part exhaustFan : Appliance {
                            attribute redefines standbyPower = 0 [W];
                            attribute redefines activePower = 50 [W];
                        }
                    }
                    part garage : Garage {
                        attribute redefines doorOpen = false;
                        port garageDoorPort redefines garageDoorPort;
                        part garageSensor : MotionSensor;
                    }

                    part hvacSystem : HVACSystem {
                        attribute redefines mass = 120 [kg];
                        attribute redefines coolingCapacity = 5000 [W];
                        attribute redefines heatingCapacity = 8000 [W];
                        attribute redefines energyEfficiencyRatio = 3.5;
                        port controlPort redefines controlPort;
                        port airSupplyPort redefines airSupplyPort;
                        port thermostatPort redefines thermostatPort;
                        perform regulateClimate.heatRoom redefines regulateTemperature;
                        part compressor {
                            attribute compressorPower :> ISQ::power = 2000 [W];
                        }
                        part airHandler {
                            action distributeAir;
                        }
                        satisfy Requirements::hvacSpec by home_b.hvacSystem {
                            requirement hvacEfficiency :>> hvacEfficiencyReq {
                                subject hvacSystem redefines hvacSystem = home_b.hvacSystem;
                            }
                        }
                    }
                    part lightingSystem : LightingSystem {
                        attribute redefines totalLumens;
                        port controlPort redefines controlPort;
                    }
                    part securitySystem : SecuritySystem {
                        attribute redefines armed = false;
                        port alarmPort redefines alarmPort;
                        port sensorPort redefines sensorPort;
                        port controlPort redefines controlPort;
                        part mainCamera : SecurityCamera {
                            attribute redefines resolution = 1920;
                            port videoPort redefines videoPort;
                        }
                        part rearCamera : SecurityCamera {
                            attribute redefines resolution = 1080;
                        }
                        part frontDoorLock : SmartLock { @Safety { isMandatory = true; } }
                        part rearDoorLock : SmartLock { @Safety { isMandatory = true; } }
                        action monitorPerimeter;
                    }
                    part energyMgmt : EnergyManagementSystem {
                        attribute redefines gridPower = 10000 [W];
                        attribute redefines solarPower = 5000 [W];
                        attribute redefines batteryLevel = 0.85;
                        port gridPort redefines gridPort;
                        port solarPort redefines solarPort;
                        port batteryPort redefines batteryPort;
                        part solarPanels : SolarPanel [8] {
                            attribute redefines peakOutput = 400 [W];
                            attribute redefines panelArea = 1.7 [m**2];
                        }
                        part battery : BatteryStorage {
                            attribute redefines capacity;
                            attribute redefines chargeLevel = 0.9;
                            port chargePort redefines chargePort;
                        }
                        perform manageEnergy.optimizeEnergy redefines optimizeEnergy;
                    }
                    part waterHeater : WaterHeater {
                        attribute redefines tankCapacity;
                        attribute redefines heatingPower = 3000 [W];
                        @EnergyRating { rating = 4; }
                    }
                    part networkHub : NetworkHub {
                        attribute redefines bandwidth = 1000.0;
                        port uplinkPort redefines uplinkPort;
                    }
                    part homeSoftware : HomeSoftware {
                        part homeController : HomeController {
                            exhibit state controllerStates redefines controllerStates;
                            part automationEngine : AutomationEngine;
                        }
                    }

                    // safety and privacy metadata on parts
                    part fireAlarmPanel { @Safety { isMandatory = true; } }
                    part privacyShield { @Privacy; }

                    // connections
                    bind hvacSystem.controlPort = commandPort;

                    interface hvacToLivingRoom : HVACToRoomInterface
                        connect hvacSystem.airSupplyPort to livingRoom.hvacPort;

                    interface hvacToBedroom1 : HVACToRoomInterface
                        connect hvacSystem.airSupplyPort to bedroom1.hvacPort;

                    interface sensorInterface : SensorToControllerInterface
                        connect livingRoom.roomDataPort to homeSoftware.homeController.automationEngine.sensorDataPort;

                    interface mainPowerInterface : PowerInterface
                        connect energyMgmt.gridPort to hvacSystem.powerInPort;

                    interface solarPowerInterface : PowerInterface
                        connect energyMgmt.solarPort to lightingSystem.powerInPort;

                    allocate ActionTree::regulateClimate.heatToDistribute to hvacToLivingRoom;

                    bind hvacSystem.thermostatPort = livingRoom.tempSensor1.commandPort;
                    connect livingRoom.motionSensor1.detectionPort to securitySystem.sensorPort;
                    connect homeSoftware.homeController.controlPort to hvacSystem.controlPort;
                    connect homeSoftware.homeController.controlPort to securitySystem.controlPort;
                    connect livingRoom.smartSpeaker1.networkPort to networkHub.uplinkPort;
                    bind livingRoom.roomDataPort = statusPort.roomStatus1;
                    bind bedroom1.roomDataPort = statusPort.roomStatus2;

                    satisfy Requirements::homeSpec by home_b {
                        requirement homePowerReq :>> homePowerRequirement {
                            attribute redefines energyActual = home_b.totalPower;
                        }
                    }
                }
            }
            package ActionTree {
                action regulateClimate : RegulateClimate {
                    in item thermostatCmd redefines thermostatCmd;
                    out airflowRate redefines airflowRate [*] = distributeAir.roomAirflow;
                    action senseTemp : SenseTemperature;
                    action heatRoom : HeatRoom {
                        in setpoint = regulateClimate.thermostatCmd;
                    }
                    action coolRoom : CoolRoom;
                    action distributeAir : DistributeAir;

                    // named flow
                    flow heatToDistribute from heatRoom.heatedAir to distributeAir.conditionedAir;
                    // unnamed flow
                    flow coolRoom.cooledAir to distributeAir.conditionedAir;
                }
                action manageLighting : ManageLighting;
                action monitorSecurity : MonitorSecurity;
                action performDiagnostics : PerformDiagnostics;
                action senseTemperature : SenseTemperature;
            }
            package DiscreteInteractions {
                package OccupantArrivalSequence {
                    part def Occupant {
                        port p1;
                        port p2;
                    }

                    part scenario0 {
                        perform action arrivalSequence {
                            action unlockDoor send lockCmd via occupant.p1 {
                                in lockCmd : LockCommand;
                            }
                            action triggerEntry accept lockCmd : LockCommand via home.commandPort;
                            flow of LockCommand from triggerEntry.lockCmd to processEntry.lockCmd;
                            action processEntry {
                                in item lockCmd : LockCommand;
                                out item status : SystemStatus;
                            }
                            flow of SystemStatus from processEntry.status to sendStatus.status;
                            action sendStatus send status via home.statusPort {
                                in status : SystemStatus;
                            }
                            action triggerAck accept status : SystemStatus via occupant.p2;
                        }
                        part occupant : Occupant {
                            perform arrivalSequence.unlockDoor;
                            perform arrivalSequence.triggerAck;
                            event occurrence occupantReady;
                        }
                        part home : SmartHome {
                            perform arrivalSequence.triggerEntry;
                            perform arrivalSequence.sendStatus;
                            event occurrence doorOpened;
                        }
                        first home.doorOpened then occupant.occupantReady;
                        message of lockCmd : LockCommand from occupant.unlockDoor to home.triggerEntry;
                        message of status : SystemStatus from home.sendStatus to occupant.triggerAck;
                    }
                }
                occurrence SecurityAlert1 {
                    part home_b :> PartsTree::home_b {
                        port redefines commandPort {
                            event occurrence commandReceived;
                        }
                        part redefines securitySystem {
                            port redefines sensorPort {
                                event occurrence motionDetected;
                            }
                            port redefines alarmPort {
                                event occurrence alarmTriggered;
                            }
                        }
                        part redefines homeSoftware {
                            part redefines homeController {
                                part redefines automationEngine {
                                    port redefines sensorDataPort {
                                        event occurrence dataReceived;
                                    }
                                    port redefines rulePort {
                                        event occurrence alertSent;
                                    }
                                }
                            }
                        }
                        message sendMotionAlert of MotionEvent
                            from securitySystem.sensorPort.motionDetected
                            to homeSoftware.homeController.automationEngine.sensorDataPort.dataReceived;
                        message sendAlarm of AlarmEvent
                            from homeSoftware.homeController.automationEngine.rulePort.alertSent
                            to securitySystem.alarmPort.alarmTriggered;
                    }
                }
            }
            package Requirements {
                public import RequirementDerivation::*;
                public import ModelingMetadata::*;
                item designStandards;
                dependency from homeSpec to designStandards;

                requirement homeSpec {
                    subject home : SmartHome;
                    requirement <'1'> homePowerRequirement : EnergyRequirement {
                        doc /* The total power consumption of the home shall not exceed the energy budget.
                        Assume solar generation offsets grid usage. */
                        attribute redefines energyBudget = 15000 [W];
                        attribute redefines energyActual default home.totalPower;
                        attribute solarOffset :> ISQ::power;
                        attribute maxGridPower :> ISQ::power = 10000 [W];
                        assume constraint { solarOffset >= 3000 [W] }
                    }

                    allocate homePowerRequirement to PartsTree::home_b.totalPower;

                    requirement <'2'> comfortRequirements {
                        doc /* comfort requirements group */
                        attribute assumedOccupancy : ScalarValues::Integer;
                        requirement <'2_1'> summerComfort : ComfortRequirement {
                            redefines tempMax = 299 [K];
                            redefines tempMin = 293 [K];
                            assume constraint { assumedOccupancy <= 6 }
                        }
                        requirement <'2_2'> winterComfort : ComfortRequirement {
                            redefines tempMax = 296 [K];
                            redefines tempMin = 291 [K];
                            assume constraint { assumedOccupancy <= 6 }

                            @StatusInfo {
                                status = StatusKind::closed;
                                originator = "Alice";
                                owner = "Bob";
                            }
                        }
                    }
                    requirement <'3'> securityResponseReq : SecurityRequirement {
                        doc /* The security system shall detect and report intrusion within 5 seconds */
                        attribute redefines responseTimeRequired = 5 [s];
                    }
                }
                requirement hvacSpec {
                    subject hvac1 : HVACSystem;
                    requirement <'1'> hvacMassRequirement : EnergyRequirement {
                        doc /* The HVAC system power shall not exceed its rated capacity */
                        attribute redefines energyBudget = 10000 [W];
                        attribute redefines energyActual;
                    }
                    requirement hvacEfficiencyReq : HVACEfficiencyRequirement {
                        subject hvacSystem default hvac1;
                    }
                    requirement hvacReliabilityReq : ReliabilityRequirement {
                        attribute redefines reliabilityRequired = 0.995;
                    }
                }
                // the HVAC power requirement is derived from the home power requirement
                #derivation connection {
                    end #original ::> homeSpec.homePowerRequirement;
                    end #derive ::> hvacSpec.hvacMassRequirement;
                }
            }
        }
        package HVACVariants {
            public import ModelingMetadata::*;
            part hvac : HVACSystem {
                part compressor [1..2] ordered;
            }
            part heatPumpVariant :> hvac {
                part redefines compressor [1];
                attribute redefines energyEfficiencyRatio = 4.0;
                attribute redefines cost = 8000;
            }
            part centralAirVariant :> hvac {
                part redefines compressor [2];
                attribute redefines energyEfficiencyRatio = 3.0;
                attribute redefines cost = 5000;
            }
            #refinement dependency heatPumpVariant to HomeConfiguration_b::PartsTree::home_b::hvacSystem;
        }
    }
    package HomeAnalysis {
        public import RiskMetadata::*;
        public import RiskLevelEnum::*;
        public import HomeConfigurations::HomeConfiguration_b::**;
        package EnergyConsumptionAnalysis {
            public import SampledFunctions::SampledFunction;

            /*
            Energy consumption model for a smart home.
            Based on time-of-use patterns and occupancy-driven load profiles.
            
            Total consumption P_total can be decomposed:
            P_total = P_base + P_hvac + P_lighting + P_appliance
            
            Where P_base is the base load (standby, networking, always-on),
            P_hvac depends on delta between setpoint and outdoor temperature,
            P_lighting depends on occupancy and time of day,
            P_appliance is the stochastic appliance load.
            
            Solar offset is computed as:
            P_solar = peakOutput * panelCount * solarIrradiance * panelEfficiency
            
            Net grid consumption = P_total - P_solar - P_battery_discharge
            */

            attribute def OccupancySchedule :> SampledFunction {
                attribute timeSlot [1..*] {
                    attribute hour [1] :> ISQ::time;
                    attribute occupants [1] : ScalarValues::Integer;
                }
            }

            calc def TotalEnergyConsumption {
                in basePower : ScalarValues::Real;
                in hvacPower : ScalarValues::Real;
                in lightingPower : ScalarValues::Real;
                in appliancePower : ScalarValues::Real;
                attribute total = basePower + hvacPower + lightingPower + appliancePower;
                return consumption : ScalarValues::Real = total;
            }

            calc def HVACEnergyConsumption {
                in hvac : HVACSystem;
                in deltaTemp :> ISQ::temperature;
                return consumption : ScalarValues::Real;
            }

            calc def SolarGeneration {
                in panels : SolarPanel;
                in panelCount : ScalarValues::Integer;
                in irradiance : ScalarValues::Real;
                return generation : ScalarValues::Real;
            }

            calc def NetGridConsumption {
                in totalConsumption : ScalarValues::Real;
                in solarGeneration : ScalarValues::Real;
                in batteryDischarge : ScalarValues::Real;
                return netGrid : ScalarValues::Real = totalConsumption - solarGeneration - batteryDischarge;
            }

            analysis energyAnalysis {
                subject = home_b;

                objective energyAnalysisObjective {
                    doc /* Estimate the home's net energy consumption and grid dependency */
                    require homeSpec.comfortRequirements;
                }

                in attribute schedule : OccupancySchedule;

                attribute hvacEnergy = HVACEnergyConsumption(home_b.hvacSystem, 5 [K]);
                attribute solarEnergy = SolarGeneration(home_b.energyMgmt.solarPanels, 8, 0.85);
                attribute baseLoad : ScalarValues::Real = 500;
                attribute lightingLoad : ScalarValues::Real = 300;
                attribute applianceLoad : ScalarValues::Real = 800;

                attribute totalConsumption = TotalEnergyConsumption(
                    baseLoad, hvacEnergy, lightingLoad, applianceLoad
                );

                return attribute netGridEnergy : ScalarValues::Real = NetGridConsumption(
                    totalConsumption, solarEnergy, 0
                );
            }
        }
        package SecurityAnalysis {
        }
        package ReliabilityAnalysis {
        }
        package HVACTradeOffAnalysis {
            /* Trade-off analysis for selecting HVAC system variant.
            Evaluates heat pump vs central air based on efficiency, cost, and reliability. */

            @Rationale about hvacTradeOff::home_heatPump {
                explanation = HomeAnalysis::HVACTradeOffAnalysis::hvacTradeOff;
                text = "the heat pump was evaluated to have a higher efficiency and lower lifetime cost compared to central air";
            }

            @Risk about hvacTradeOff::home_heatPump {
                totalRisk = low;
                technicalRisk = low;
                scheduleRisk = medium;
                costRisk = RiskLevelEnum::medium;
            }
            @Risk about hvacTradeOff::home_heatPump::hvacSystem::energyEfficiencyRatio {
                technicalRisk {
                    probability = 0.2;
                    impact = 0.4;
                }
            }

            public import TradeStudies::*;
            calc def HVACEvaluation {
                in hvacMass :> ISQ::mass;
                in hvacEfficiency : ScalarValues::Real;
                in hvacCost : ScalarValues::Real;
                return eval : ScalarValues::Real;
            }
            calc def HVACEvaluation_HeatPump {
                in hvacMass :> ISQ::mass;
                in hvacEfficiency : ScalarValues::Real;
                in hvacCost : ScalarValues::Real;
                return eval : ScalarValues::Real;
            }
            calc def HVACEvaluation_CentralAir {
                in hvacMass :> ISQ::mass;
                in hvacEfficiency : ScalarValues::Real;
                in hvacCost : ScalarValues::Real;
                return eval : ScalarValues::Real;
            }
            analysis hvacTradeOff : TradeStudy {
                subject homeAlternatives [2] :> home_b;

                part home_heatPump :> homeAlternatives {
                    part hvacSystem redefines hvacSystem {
                        attribute mass redefines mass = 100 [kg];
                        attribute energyEfficiencyRatio redefines energyEfficiencyRatio = 4.0;
                        attribute cost redefines cost = 8000;
                    }
                }
                part home_centralAir :> homeAlternatives {
                    part hvacSystem redefines hvacSystem {
                        attribute mass redefines mass = 150 [kg];
                        attribute energyEfficiencyRatio redefines energyEfficiencyRatio = 3.0;
                        attribute cost redefines cost = 5000;
                    }
                }

                objective : MaximizeObjective;
                    /* Select home alternative whose HVAC evaluation function returns the max value */

                calc :> evaluationFunction {
                    in part home :> home_heatPump;
                    return attribute eval : ScalarValues::Real = HVACEvaluation_HeatPump(
                        home.hvacSystem.mass, home.hvacSystem.energyEfficiencyRatio, home.hvacSystem.cost
                    );
                }
                calc :> evaluationFunction {
                    in part home :> home_centralAir;
                    return attribute eval : ScalarValues::Real = HVACEvaluation_CentralAir(
                        home.hvacSystem.mass, home.hvacSystem.energyEfficiencyRatio, home.hvacSystem.cost
                    );
                }
                return part selectedHome :> home_b;
            }
        }
    }
    package HomeVerification {
        public import HomeConfigurations::HomeConfiguration_b::**;
        public import VerificationCaseDefinitions::*;
        public import VerificationCases1::*;
        public import VerificationCases::*;
        public import VerificationSystem::*;
        package VerificationCaseDefinitions {
            verification def EnergyTest;
            verification def SecurityResponseTest;
            verification def ComfortTest;
        }
        package VerificationCases1 {
            verification energyTests : EnergyTest {
                subject home_uut :> home_b;
                actor testSystem = verificationContext.energyVerificationSystem;
                objective {
                    verify homeSpec.homePowerRequirement {
                        redefines energyActual = measurePower.powerMeasured;
                    }
                }
                @VerificationMethod {
                    kind = (VerificationMethodKind::test, VerificationMethodKind::analyze);
                }
                action measurePower {
                    out powerMeasured :> ISQ::power;
                }
                then action evaluatePassFail {
                    in powerMeasured :> ISQ::power;
                    out verdict = PassIf(homeSpec.homePowerRequirement(home_uut));
                }
                flow from measurePower.powerMeasured to evaluatePassFail.powerMeasured;
                return :>> verdict = evaluatePassFail.verdict;
            }
        }
        package VerificationSystem {
            part verificationContext {
                perform energyTests;
                part home_UnitUnderTest :> home_b;
                part energyVerificationSystem {
                    part powerMeter {
                        perform energyTests.measurePower;
                    }
                    part testOperator {
                        perform energyTests.evaluatePassFail;
                    }
                }
            }
        }
    }
    package HomeIndividuals {
        individual a : HomeContext_1 {
            timeslice morning {
                snapshot t0_home {
                    attribute t0 redefines time = 0 [s];
                    snapshot t0_living : LivingRoom_1 {
                        :>> LivingRoom::roomTemp = 293 [K];
                        :>> LivingRoom::luminance = 200 [cd];
                    }
                    snapshot t0_home_sys : SmartHome_1 {
                        :>> SmartHome::indoorTemp = 293 [K];
                        :>> SmartHome::outdoorTemp = 278 [K];
                        :>> SmartHome::occupancy = 2;
                        snapshot t0_hvac : HVACSystem_1;
                        snapshot t0_security : SecuritySystem_1;
                    }
                }
                snapshot t1_home {
                    attribute t1 redefines time = 3600 [s];
                    snapshot t1_living : LivingRoom_1 {
                        :>> LivingRoom::roomTemp = 295 [K];
                        :>> LivingRoom::luminance = 400 [cd];
                    }
                    snapshot t1_home_sys : SmartHome_1 {
                        :>> SmartHome::indoorTemp = 295 [K];
                        :>> SmartHome::outdoorTemp = 280 [K];
                        :>> SmartHome::occupancy = 4;
                        snapshot t1_hvac : HVACSystem_1;
                        snapshot t1_security : SecuritySystem_1;
                    }
                }
                snapshot t2_home {
                    attribute t2 redefines time = 7200 [s];
                    snapshot t2_living : LivingRoom_1 {
                        :>> LivingRoom::roomTemp = 296 [K];
                        :>> LivingRoom::luminance = 500 [cd];
                    }
                    snapshot t2_home_sys : SmartHome_1 {
                        :>> SmartHome::indoorTemp = 296 [K];
                        :>> SmartHome::outdoorTemp = 282 [K];
                        :>> SmartHome::occupancy = 3;
                        snapshot t2_hvac : HVACSystem_1;
                        snapshot t2_solar : SolarPanel_1;
                    }
                }
            }
        }
    }
    package MissionContext {
        /* Define mission context with use cases for smart home occupant scenarios */
        public import HomeConfigurations::HomeConfiguration_b::**;
        public import ParametersOfInterestMetadata::moe;
        public import OccupantScenario::*;
        package ContextDefinitions {
            part def HomeMissionContext :> GenericContext::Context;
            part def Neighborhood;
            part def Occupant {
                port handPort : CommandPort {
                }
                exhibit state occupantStates {
                    state initial;
                    state waiting;
                    transition initial then waiting;
                    // arrive home
                    transition 'wait-arrive'
                        first waiting
                        do send new OccupantCommand(commandType = CommandType::arrive) via handPort
                        then waiting;
                    // depart home
                    transition 'wait-depart'
                        first waiting
                        do send new OccupantCommand(commandType = CommandType::depart) via handPort
                        then waiting;
                }
            }
            part def Guest;

            requirement homeComfortRequirements;
            use case def ManageComfort {
                objective ComfortObjective {
                    doc /* Maintain occupant comfort through climate, lighting, and security automation */
                    require homeComfortRequirements;
                }
                subject home : SmartHome;
                actor environment;
                actor neighborhood;
                actor occupant;
                actor guest [0..4];
                include use case enterHome_a :> enterHome [1..5];
                include use case leaveHome_a :> leaveHome [1..5];
            }

            use case enterHome : EnterHome {
                action unlockDoor [0..1];
                then action openDoor;
                then action enterHouse;
                then action closeDoor;
            }
            use case def EnterHome {
                subject home : SmartHome;
                actor occupant [0..1];
                actor guest [0..1];
                assert constraint { occupant != null xor guest != null }
            }

            use case leaveHome : LeaveHome {
                action openDoor_out;
                then action exitHouse;
                then action closeDoor_out;
                then action lockDoor;
            }
            use case def LeaveHome {
                subject home : SmartHome;
                actor occupant [0..1];
                actor guest [0..1];
                assert constraint { occupant != null xor guest != null }
            }
        }
        package OccupantScenario {
            public import ContextDefinitions::ManageComfort;

            // nested version using sequential action groups
            use case manageComfort : ManageComfort {
                first start;
                then action a {
                    action occupantEnterHome subsets enterHome_a [1];
                    action guestEnterHome subsets enterHome_a [1];
                }
                then action triggerArrival accept cmd : OccupantCommand;
                then action b {
                    action regulateClimate;
                    action manageLighting;
                }
                then action c {
                    action occupantLeaveHome subsets leaveHome_a [1];
                    action guestLeaveHome subsets leaveHome_a [1];
                }
                then done;
            }

            // fork/join version
            use case manageComfort_1 : ManageComfort {
                action occupantEnterHome subsets enterHome_a [1];
                action guestEnterHome subsets enterHome_a [1];
                action occupantLeaveHome subsets leaveHome_a [1];
                action guestLeaveHome subsets leaveHome_a [1];
                action regulateClimate;
                action manageLighting;
                join join1;
                join join2;
                join join3;
                action triggerArrival accept cmd : OccupantCommand;

                first start;
                then fork fork1;
                    then occupantEnterHome;
                    then guestEnterHome;
                first occupantEnterHome then join1;
                first guestEnterHome then join1;
                first join1 then triggerArrival;
                first triggerArrival then fork2;

                fork fork2;
                    then regulateClimate;
                    then manageLighting;
                first regulateClimate then join2;
                first manageLighting then join2;
                first join2 then fork3;

                fork fork3;
                    then occupantLeaveHome;
                    then guestLeaveHome;
                first occupantLeaveHome then join3;
                first guestLeaveHome then join3;

                first join3 then done;
            }
        }

        part missionContext : ContextDefinitions::HomeMissionContext {
            #moe attribute comfortDuration :> ISQ::time;
            perform manageComfort;
            // bind parts to actors of use case
            part neighborhood : ContextDefinitions::Neighborhood = manageComfort.neighborhood;
            part occupant1 : ContextDefinitions::Occupant = manageComfort.occupant {
                perform manageComfort.a.occupantEnterHome.unlockDoor;
                perform manageComfort.a.occupantEnterHome.openDoor;
                perform manageComfort.a.occupantEnterHome.enterHouse;
                perform manageComfort.a.occupantEnterHome.closeDoor;
                perform manageComfort.c.occupantLeaveHome.openDoor_out;
                perform manageComfort.c.occupantLeaveHome.exitHouse;
                perform manageComfort.c.occupantLeaveHome.closeDoor_out;
                perform manageComfort.c.occupantLeaveHome.lockDoor;
            }
            part guest1 : ContextDefinitions::Guest = manageComfort.guest {
                perform manageComfort.a.guestEnterHome.unlockDoor;
                perform manageComfort.a.guestEnterHome.openDoor;
                perform manageComfort.a.guestEnterHome.enterHouse;
                perform manageComfort.a.guestEnterHome.closeDoor;
                perform manageComfort.c.guestLeaveHome.openDoor_out;
                perform manageComfort.c.guestLeaveHome.exitHouse;
                perform manageComfort.c.guestLeaveHome.closeDoor_out;
                perform manageComfort.c.guestLeaveHome.lockDoor;
            }
            part home_b_1 :> home_b = manageComfort.home {
                perform manageComfort.b.regulateClimate redefines regulateClimate;
                perform manageComfort.b.manageLighting redefines manageLighting;
                perform manageComfort.triggerArrival;
            }
            connect occupant1.handPort to home_b_1.commandPort;
            connect neighborhood to home_b_1.networkPort;
        }
    }
    package HomeSuperSetModel {
        /* All of homeFamily is included in the superset model to enable subsetting a specific home configuration */
        package VariationPointDefinitions {
            variation part def HVACChoices :> HVACSystem {
                variant part heatPump : HeatPumpSystem;
                variant part centralAir : CentralAirSystem;
                variant part miniSplit : MiniSplitSystem;
            }
        }
        package HomePartsTree {
            public import VariationPointDefinitions::*;
            abstract part homeFamily {
                // variation with nested variation
                variation part hvac : HVACSystem {
                    variant part heatPump : HeatPumpSystem;
                    variant part centralAir : CentralAirSystem {
                        part compressor [2] {
                            variation attribute coolingCapacity :> ISQ::power {
                                variant attribute standardCapacity :> ISQ::power;
                                variant attribute highCapacity :> ISQ::power;
                            }
                        }
                    }
                }
                // variation point based on variation of part definition
                part hvacChoices : HVACChoices;
                // optional variation
                part solarPanels : SolarPanel [0..16];
                // selection constraint
                assert constraint selectionConstraint {
                    (hvac == hvac::heatPump and solarPanels != null) xor
                    (hvac == hvac::centralAir)
                }
                part rooms;
                part securitySystem;
                part networkHub;
            }
        }
    }
    package SafetyAndPrivacyGroups {
        public import HomeConfigurations::HomeConfiguration_b::PartsTree::*;
        package SafetyGroup {
            /* Parts that contribute to safety. */
            public import home_b::**;
            filter @Safety;
        }
        package PrivacyGroup {
            /* Parts that contribute to privacy. */
            public import home_b::**;
            filter @Privacy;
        }
        package SafetyAndPrivacyGroup {
            /* Parts that contribute to safety OR privacy. */
            public import home_b::**;
            filter @Safety or @Privacy;
        }
        package MandatorySafetyGroup {
            /* Parts that contribute to safety AND are mandatory. */
            public import home_b::**;
            filter @Safety and (as Safety).isMandatory;
        }
    }
    package Views_Viewpoints {
        package ViewpointDefinitions {
            viewpoint def EnergyViewpoint;
            viewpoint def SafetyViewpoint {
                frame concern hs : HomeSafety;
            }
            part def SafetyEngineer;
            concern def HomeSafety {
                doc /* identify home safety features and compliance with building codes */
                subject;
                stakeholder se : SafetyEngineer;
            }
        }
        package ViewDefinitions {
            public import Views::*;
            view def TreeView {
                render asTreeDiagram;
            }
            view def NestedView;
            view def RelationshipView;
            view def TableView;
            view def PartsTreeView :> TreeView {
                filter @SysML::PartUsage;
            }
            view def PartsInterconnection :> NestedView;
        }
        package HomeViews {
            public import ViewpointDefinitions::*;
            public import ViewDefinitions::*;
            public import HomeConfigurations::HomeConfiguration_b::*;
            view homePartsTree_Safety : PartsTreeView {
                satisfy requirement sv : SafetyViewpoint;
                expose PartsTree::**;
                filter @Safety;
            }
        }
    }
}
