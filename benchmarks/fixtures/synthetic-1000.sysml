// ~1000 line SysML model for benchmark scaling tests
package Synthetic1000 {

    // ═══════════════════════════════════════════════════════════════
    //  ATTRIBUTE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    attribute def Temperature;
    attribute def Pressure;
    attribute def Voltage;
    attribute def Current;
    attribute def Mass;
    attribute def Length;
    attribute def Speed;
    attribute def Frequency;
    attribute def Duration;
    attribute def Power;
    attribute def Acceleration;
    attribute def Angle;
    attribute def Torque;
    attribute def FlowRate;
    attribute def Density;
    attribute def Resistance;
    attribute def Capacitance;
    attribute def Inductance;
    attribute def Luminosity;
    attribute def Humidity;

    // ═══════════════════════════════════════════════════════════════
    //  ENUMERATIONS
    // ═══════════════════════════════════════════════════════════════
    enum def OperationalStatus {
        nominal;
        degraded;
        failed;
        maintenance;
        standby;
        startup;
        shutdown;
        emergency;
    }

    enum def Priority {
        critical;
        high;
        medium;
        low;
        info;
    }

    enum def ConnectionType {
        wired;
        wireless;
        optical;
        hybrid;
    }

    enum def Protocol {
        ethernet;
        canbus;
        modbus;
        profinet;
        mqtt;
        opcua;
    }

    enum def SafetyLevel {
        sil1;
        sil2;
        sil3;
        sil4;
    }

    enum def RedundancyMode {
        none;
        active_standby;
        active_active;
        triple_modular;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PORT DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    port def PowerPort {
        attribute voltage : Voltage;
        attribute current : Current;
        attribute maxPower : Power;
    }

    port def DataPort {
        attribute bandwidth : Frequency;
        attribute protocol : Voltage;
        attribute latency : Duration;
    }

    port def SensorPort {
        attribute sampleRate : Frequency;
        attribute resolution : Voltage;
        attribute accuracy : Voltage;
    }

    port def ControlPort {
        attribute commandRate : Frequency;
        attribute feedbackRate : Frequency;
        attribute responseTime : Duration;
    }

    port def ThermalPort {
        attribute temperature : Temperature;
        attribute heatFlux : Power;
        attribute thermalResistance : Resistance;
    }

    port def HydraulicPort {
        attribute pressure : Pressure;
        attribute flowRate : FlowRate;
    }

    port def PneumaticPort {
        attribute pressure : Pressure;
        attribute flowRate : FlowRate;
    }

    port def MechanicalPort {
        attribute torque : Torque;
        attribute speed : Speed;
    }

    // ═══════════════════════════════════════════════════════════════
    //  INTERFACE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    interface def PowerInterface {
        end source : PowerPort;
        end sink : PowerPort;
    }

    interface def DataLink {
        end sender : DataPort;
        end receiver : DataPort;
    }

    interface def ControlLoop {
        end controller : ControlPort;
        end plant : ControlPort;
    }

    interface def ThermalCoupling {
        end hot : ThermalPort;
        end cold : ThermalPort;
    }

    interface def HydraulicLine {
        end supply : HydraulicPort;
        end return_ : HydraulicPort;
    }

    interface def MechanicalCoupling {
        end driver : MechanicalPort;
        end driven : MechanicalPort;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SENSOR PART DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def TemperatureSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Temperature;
        attribute range_min : Temperature;
        attribute range_max : Temperature;
        attribute calibrationDate : Duration;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def PressureSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Pressure;
        attribute maxPressure : Pressure;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def VoltageSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Voltage;
        attribute maxVoltage : Voltage;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def CurrentSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Current;
        attribute maxCurrent : Current;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def SpeedSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Speed;
        attribute maxSpeed : Speed;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def AccelerationSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Acceleration;
        attribute axes : Voltage;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def FlowSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : FlowRate;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def HumiditySensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Humidity;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def LevelSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute maxLevel : Length;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def ProximitySensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute maxRange : Length;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACTUATOR PART DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def ElectricMotor {
        attribute motorId : Voltage;
        attribute status : OperationalStatus;
        attribute maxSpeed : Speed;
        attribute maxTorque : Torque;
        attribute efficiency : Voltage;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port mechOut : MechanicalPort;
        port thermalOut : ThermalPort;
    }

    part def StepperMotor {
        attribute motorId : Voltage;
        attribute status : OperationalStatus;
        attribute stepsPerRev : Voltage;
        attribute holdingTorque : Torque;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port mechOut : MechanicalPort;
    }

    part def ServoMotor {
        attribute motorId : Voltage;
        attribute status : OperationalStatus;
        attribute maxAngle : Angle;
        attribute maxTorque : Torque;
        attribute responseTime : Duration;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port mechOut : MechanicalPort;
    }

    part def ControlValve {
        attribute valveId : Voltage;
        attribute status : OperationalStatus;
        attribute position : Voltage;
        attribute maxPressure : Pressure;
        attribute flowCoefficient : FlowRate;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port processIn : HydraulicPort;
        port processOut : HydraulicPort;
    }

    part def SolenoidValve {
        attribute valveId : Voltage;
        attribute status : OperationalStatus;
        attribute responseTime : Duration;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port processIn : PneumaticPort;
        port processOut : PneumaticPort;
    }

    part def Heater {
        attribute heaterId : Voltage;
        attribute status : OperationalStatus;
        attribute maxPower : Power;
        attribute resistance : Resistance;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port thermalOut : ThermalPort;
    }

    part def Cooler {
        attribute coolerId : Voltage;
        attribute status : OperationalStatus;
        attribute coolingCapacity : Power;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port thermalIn : ThermalPort;
        port thermalOut : ThermalPort;
    }

    part def Pump {
        attribute pumpId : Voltage;
        attribute status : OperationalStatus;
        attribute maxFlowRate : FlowRate;
        attribute maxPressure : Pressure;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port mechIn : MechanicalPort;
        port fluidOut : HydraulicPort;
    }

    part def Relay {
        attribute relayId : Voltage;
        attribute status : OperationalStatus;
        attribute switchCycles : Voltage;
        attribute contactRating : Current;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port switchedPower : PowerPort;
    }

    part def LinearActuator {
        attribute actuatorId : Voltage;
        attribute status : OperationalStatus;
        attribute stroke : Length;
        attribute maxForce : Power;
        attribute speed : Speed;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONTROLLER DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def MicroController {
        attribute controllerId : Voltage;
        attribute status : OperationalStatus;
        attribute clockFrequency : Frequency;
        attribute memorySize : Voltage;
        attribute safetyLevel : SafetyLevel;
        port powerIn : PowerPort;
        port sensorIn1 : SensorPort;
        port sensorIn2 : SensorPort;
        port controlOut1 : ControlPort;
        port controlOut2 : ControlPort;
        port dataComm : DataPort;
    }

    part def PLCController {
        attribute controllerId : Voltage;
        attribute status : OperationalStatus;
        attribute scanRate : Frequency;
        attribute safetyLevel : SafetyLevel;
        attribute redundancy : RedundancyMode;
        port powerIn : PowerPort;
        port sensorIn1 : SensorPort;
        port sensorIn2 : SensorPort;
        port sensorIn3 : SensorPort;
        port sensorIn4 : SensorPort;
        port controlOut1 : ControlPort;
        port controlOut2 : ControlPort;
        port controlOut3 : ControlPort;
        port controlOut4 : ControlPort;
        port dataComm1 : DataPort;
        port dataComm2 : DataPort;
    }

    part def SafetyController {
        attribute controllerId : Voltage;
        attribute status : OperationalStatus;
        attribute safetyLevel : SafetyLevel;
        attribute redundancy : RedundancyMode;
        attribute diagnosticCoverage : Voltage;
        port powerIn : PowerPort;
        port sensorIn1 : SensorPort;
        port sensorIn2 : SensorPort;
        port sensorIn3 : SensorPort;
        port emergencyOut1 : ControlPort;
        port emergencyOut2 : ControlPort;
        port dataComm : DataPort;
    }

    part def SupervisoryController {
        attribute controllerId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;
        attribute redundancy : RedundancyMode;
        port powerIn : PowerPort;
        port dataIn1 : DataPort;
        port dataIn2 : DataPort;
        port dataIn3 : DataPort;
        port dataIn4 : DataPort;
        port commandOut1 : DataPort;
        port commandOut2 : DataPort;
        port commandOut3 : DataPort;
    }

    // ═══════════════════════════════════════════════════════════════
    //  POWER SUPPLY DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def ACPowerSupply {
        attribute supplyId : Voltage;
        attribute status : OperationalStatus;
        attribute inputVoltage : Voltage;
        attribute outputVoltage : Voltage;
        attribute maxCurrent : Current;
        attribute efficiency : Voltage;
        attribute redundancy : RedundancyMode;
        port powerIn : PowerPort;
        port powerOut1 : PowerPort;
        port powerOut2 : PowerPort;
        port powerOut3 : PowerPort;
        port thermalOut : ThermalPort;
    }

    part def DCPowerSupply {
        attribute supplyId : Voltage;
        attribute status : OperationalStatus;
        attribute outputVoltage : Voltage;
        attribute maxCurrent : Current;
        port powerIn : PowerPort;
        port powerOut : PowerPort;
    }

    part def BatteryBackup {
        attribute batteryId : Voltage;
        attribute status : OperationalStatus;
        attribute capacity : Power;
        attribute chargeLevel : Voltage;
        attribute chargeCycles : Voltage;
        port powerIn : PowerPort;
        port powerOut : PowerPort;
    }

    part def UPS {
        attribute upsId : Voltage;
        attribute status : OperationalStatus;
        attribute capacity : Power;
        attribute transferTime : Duration;
        part battery : BatteryBackup;
        port powerIn : PowerPort;
        port powerOut : PowerPort;
    }

    // ═══════════════════════════════════════════════════════════════
    //  COMMUNICATION DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def NetworkSwitch {
        attribute switchId : Voltage;
        attribute status : OperationalStatus;
        attribute portCount : Voltage;
        attribute bandwidth : Frequency;
        port powerIn : PowerPort;
        port dataPort1 : DataPort;
        port dataPort2 : DataPort;
        port dataPort3 : DataPort;
        port dataPort4 : DataPort;
        port dataPort5 : DataPort;
        port dataPort6 : DataPort;
        port dataPort7 : DataPort;
        port dataPort8 : DataPort;
    }

    part def Gateway {
        attribute gatewayId : Voltage;
        attribute status : OperationalStatus;
        attribute protocolConversion : Protocol;
        port powerIn : PowerPort;
        port localNet : DataPort;
        port remoteNet : DataPort;
    }

    part def Firewall {
        attribute firewallId : Voltage;
        attribute status : OperationalStatus;
        port powerIn : PowerPort;
        port internalNet : DataPort;
        port externalNet : DataPort;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MODULE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def EnvironmentSensorModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part tempSensor1 : TemperatureSensor;
        part tempSensor2 : TemperatureSensor;
        part pressureSensor : PressureSensor;
        part humiditySensor : HumiditySensor;
        part controller : MicroController;
        part power : DCPowerSupply;
    }

    part def ProcessSensorModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part flowSensor1 : FlowSensor;
        part flowSensor2 : FlowSensor;
        part pressureSensor1 : PressureSensor;
        part pressureSensor2 : PressureSensor;
        part levelSensor : LevelSensor;
        part tempSensor : TemperatureSensor;
        part controller : PLCController;
        part power : DCPowerSupply;
    }

    part def MotionSensorModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;

        part speedSensor1 : SpeedSensor;
        part speedSensor2 : SpeedSensor;
        part accelSensor : AccelerationSensor;
        part proxSensor1 : ProximitySensor;
        part proxSensor2 : ProximitySensor;
        part controller : MicroController;
        part power : DCPowerSupply;
    }

    part def MotorDriveModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part motor1 : ElectricMotor;
        part motor2 : ElectricMotor;
        part stepper1 : StepperMotor;
        part controller : PLCController;
        part power : ACPowerSupply;
        part relay1 : Relay;
        part relay2 : Relay;
        part cooler : Cooler;
    }

    part def ValveControlModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;

        part controlValve1 : ControlValve;
        part controlValve2 : ControlValve;
        part controlValve3 : ControlValve;
        part solenoid1 : SolenoidValve;
        part solenoid2 : SolenoidValve;
        part controller : MicroController;
        part power : DCPowerSupply;
    }

    part def ThermalControlModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;

        part heater1 : Heater;
        part heater2 : Heater;
        part cooler1 : Cooler;
        part tempSensor1 : TemperatureSensor;
        part tempSensor2 : TemperatureSensor;
        part controller : MicroController;
        part power : ACPowerSupply;
    }

    part def PumpModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;

        part pump1 : Pump;
        part pump2 : Pump;
        part motor1 : ElectricMotor;
        part motor2 : ElectricMotor;
        part flowSensor : FlowSensor;
        part pressureSensor : PressureSensor;
        part controller : PLCController;
        part power : ACPowerSupply;
    }

    part def SafetyModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute safetyLevel : SafetyLevel;

        part safetyController : SafetyController;
        part tempSensor : TemperatureSensor;
        part pressureSensor : PressureSensor;
        part proxSensor : ProximitySensor;
        part emergencyRelay1 : Relay;
        part emergencyRelay2 : Relay;
        part emergencyValve : SolenoidValve;
        part power : DCPowerSupply;
        part battery : BatteryBackup;
    }

    part def CommunicationModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;

        part switch1 : NetworkSwitch;
        part switch2 : NetworkSwitch;
        part gateway : Gateway;
        part firewall : Firewall;
        part power : DCPowerSupply;
        part ups : UPS;
    }

    part def ControlModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part mainController : PLCController;
        part backupController : PLCController;
        part power : ACPowerSupply;
        part battery : BatteryBackup;
        part networkSwitch : NetworkSwitch;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SUBSYSTEM DEFINITIONS
    // ═══════════════════════════════════════════════════════════════
    part def EnvironmentMonitoringSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part envModule1 : EnvironmentSensorModule;
        part envModule2 : EnvironmentSensorModule;
        part envModule3 : EnvironmentSensorModule;
        part envModule4 : EnvironmentSensorModule;
        part controlModule : ControlModule;
        part commModule : CommunicationModule;
    }

    part def ProcessControlSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part sensorModule1 : ProcessSensorModule;
        part sensorModule2 : ProcessSensorModule;
        part valveModule1 : ValveControlModule;
        part valveModule2 : ValveControlModule;
        part pumpModule : PumpModule;
        part thermalModule : ThermalControlModule;
        part controlModule : ControlModule;
        part commModule : CommunicationModule;
    }

    part def MotionControlSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part motionSensors1 : MotionSensorModule;
        part motionSensors2 : MotionSensorModule;
        part motorDrive1 : MotorDriveModule;
        part motorDrive2 : MotorDriveModule;
        part controlModule : ControlModule;
        part commModule : CommunicationModule;
    }

    part def SafetySubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;
        attribute safetyLevel : SafetyLevel;

        part safetyModule1 : SafetyModule;
        part safetyModule2 : SafetyModule;
        part safetyModule3 : SafetyModule;
        part envMonitor : EnvironmentSensorModule;
        part commModule : CommunicationModule;
    }

    part def PowerDistributionSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part mainSupply1 : ACPowerSupply;
        part mainSupply2 : ACPowerSupply;
        part dcSupply1 : DCPowerSupply;
        part dcSupply2 : DCPowerSupply;
        part dcSupply3 : DCPowerSupply;
        part ups1 : UPS;
        part ups2 : UPS;
        part voltageSensor1 : VoltageSensor;
        part voltageSensor2 : VoltageSensor;
        part currentSensor1 : CurrentSensor;
        part currentSensor2 : CurrentSensor;
        part controlModule : ControlModule;
    }

    part def NetworkSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;

        part coreSwitch : NetworkSwitch;
        part accessSwitch1 : NetworkSwitch;
        part accessSwitch2 : NetworkSwitch;
        part accessSwitch3 : NetworkSwitch;
        part gateway1 : Gateway;
        part gateway2 : Gateway;
        part firewall : Firewall;
        part power : ACPowerSupply;
        part ups : UPS;
    }

    part def SupervisorySubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;

        part supervisor1 : SupervisoryController;
        part supervisor2 : SupervisoryController;
        part commModule : CommunicationModule;
        part power : ACPowerSupply;
        part battery : BatteryBackup;
    }

    // ═══════════════════════════════════════════════════════════════
    //  TOP-LEVEL SYSTEM
    // ═══════════════════════════════════════════════════════════════
    part def IndustrialAutomationSystem {
        attribute systemId : Voltage;
        attribute systemStatus : OperationalStatus;
        attribute totalMass : Mass;
        attribute operatingTemp : Temperature;
        attribute operatingPressure : Pressure;
        attribute safetyLevel : SafetyLevel;

        // Subsystems
        part envMonitoring : EnvironmentMonitoringSubsystem;
        part processControl : ProcessControlSubsystem;
        part motionControl : MotionControlSubsystem;
        part safety : SafetySubsystem;
        part powerDist : PowerDistributionSubsystem;
        part network : NetworkSubsystem;
        part supervisory : SupervisorySubsystem;
    }

    // ─── Deployment Instances ────────────────────────────────────
    part plantA : IndustrialAutomationSystem;
    part plantB : IndustrialAutomationSystem;
}
