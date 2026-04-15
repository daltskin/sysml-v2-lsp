// ~500 line SysML model for benchmark scaling tests
package Synthetic500 {

    // ─── Attribute Definitions ───────────────────────────────────
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

    // ─── Enumerations ────────────────────────────────────────────
    enum def OperationalStatus {
        nominal;
        degraded;
        failed;
        maintenance;
        standby;
        startup;
        shutdown;
    }

    enum def Priority {
        critical;
        high;
        medium;
        low;
    }

    enum def ConnectionType {
        wired;
        wireless;
        optical;
        hybrid;
    }

    // ─── Port Definitions ────────────────────────────────────────
    port def PowerPort {
        attribute voltage : Voltage;
        attribute current : Current;
        attribute maxPower : Power;
    }

    port def DataPort {
        attribute bandwidth : Frequency;
        attribute protocol : Voltage;
    }

    port def SensorPort {
        attribute sampleRate : Frequency;
        attribute resolution : Voltage;
    }

    port def ControlPort {
        attribute commandRate : Frequency;
        attribute feedbackRate : Frequency;
    }

    port def ThermalPort {
        attribute temperature : Temperature;
        attribute heatFlux : Power;
    }

    // ─── Interface Definitions ───────────────────────────────────
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

    // ─── Sensor Definitions ──────────────────────────────────────
    part def TemperatureSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Temperature;
        attribute range_min : Temperature;
        attribute range_max : Temperature;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def PressureSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Pressure;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def VoltageSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Voltage;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def CurrentSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Current;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    part def SpeedSensor {
        attribute sensorId : Voltage;
        attribute status : OperationalStatus;
        attribute accuracy : Speed;
        port dataOut : SensorPort;
        port powerIn : PowerPort;
    }

    // ─── Actuator Definitions ────────────────────────────────────
    part def Motor {
        attribute motorId : Voltage;
        attribute status : OperationalStatus;
        attribute maxSpeed : Speed;
        attribute maxTorque : Power;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port thermalOut : ThermalPort;
    }

    part def Valve {
        attribute valveId : Voltage;
        attribute status : OperationalStatus;
        attribute position : Voltage;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
    }

    part def Heater {
        attribute heaterId : Voltage;
        attribute status : OperationalStatus;
        attribute maxPower : Power;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port thermalOut : ThermalPort;
    }

    part def Relay {
        attribute relayId : Voltage;
        attribute status : OperationalStatus;
        attribute switchCycles : Voltage;
        port powerIn : PowerPort;
        port controlIn : ControlPort;
        port powerOut : PowerPort;
    }

    // ─── Controller Definitions ──────────────────────────────────
    part def MicroController {
        attribute controllerId : Voltage;
        attribute status : OperationalStatus;
        attribute clockFrequency : Frequency;
        attribute memorySize : Voltage;
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
        port powerIn : PowerPort;
        port sensorIn1 : SensorPort;
        port sensorIn2 : SensorPort;
        port sensorIn3 : SensorPort;
        port sensorIn4 : SensorPort;
        port controlOut1 : ControlPort;
        port controlOut2 : ControlPort;
        port controlOut3 : ControlPort;
        port dataComm : DataPort;
    }

    part def SupervisoryController {
        attribute controllerId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;
        port powerIn : PowerPort;
        port dataIn1 : DataPort;
        port dataIn2 : DataPort;
        port dataIn3 : DataPort;
        port commandOut1 : DataPort;
        port commandOut2 : DataPort;
    }

    // ─── Power Supply Definitions ────────────────────────────────
    part def ACPowerSupply {
        attribute supplyId : Voltage;
        attribute status : OperationalStatus;
        attribute inputVoltage : Voltage;
        attribute outputVoltage : Voltage;
        attribute maxCurrent : Current;
        attribute efficiency : Voltage;
        port powerIn : PowerPort;
        port powerOut1 : PowerPort;
        port powerOut2 : PowerPort;
        port thermalOut : ThermalPort;
    }

    part def BatteryBackup {
        attribute batteryId : Voltage;
        attribute status : OperationalStatus;
        attribute capacity : Power;
        attribute chargeLevel : Voltage;
        port powerIn : PowerPort;
        port powerOut : PowerPort;
    }

    // ─── Communication Definitions ───────────────────────────────
    part def NetworkSwitch {
        attribute switchId : Voltage;
        attribute status : OperationalStatus;
        attribute portCount : Voltage;
        port powerIn : PowerPort;
        port dataPort1 : DataPort;
        port dataPort2 : DataPort;
        port dataPort3 : DataPort;
        port dataPort4 : DataPort;
    }

    part def Gateway {
        attribute gatewayId : Voltage;
        attribute status : OperationalStatus;
        port powerIn : PowerPort;
        port localNet : DataPort;
        port remoteNet : DataPort;
    }

    // ─── Module Definitions ──────────────────────────────────────
    part def SensorModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part tempSensor : TemperatureSensor;
        part pressureSensor : PressureSensor;
        part voltageSensor : VoltageSensor;
        part controller : MicroController;
        part power : ACPowerSupply;
    }

    part def ActuatorModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part motor1 : Motor;
        part motor2 : Motor;
        part valve1 : Valve;
        part heater1 : Heater;
        part controller : MicroController;
        part power : ACPowerSupply;
        part relay1 : Relay;
        part relay2 : Relay;
    }

    part def ControlModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;
        attribute mass : Mass;

        part mainController : PLCController;
        part backupController : MicroController;
        part power : ACPowerSupply;
        part battery : BatteryBackup;
        part networkSwitch : NetworkSwitch;
    }

    part def CommunicationModule {
        attribute moduleId : Voltage;
        attribute status : OperationalStatus;

        part switch1 : NetworkSwitch;
        part switch2 : NetworkSwitch;
        part gateway : Gateway;
        part power : ACPowerSupply;
    }

    // ─── Subsystem Definitions ───────────────────────────────────
    part def MonitoringSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part sensorModule1 : SensorModule;
        part sensorModule2 : SensorModule;
        part sensorModule3 : SensorModule;
        part controlModule : ControlModule;
        part commModule : CommunicationModule;
    }

    part def ActuationSubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part actuatorModule1 : ActuatorModule;
        part actuatorModule2 : ActuatorModule;
        part controlModule : ControlModule;
        part commModule : CommunicationModule;
    }

    part def SafetySubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;
        attribute priority : Priority;

        part emergencySensors : SensorModule;
        part safetyController : ControlModule;
        part safetyActuators : ActuatorModule;
        part commModule : CommunicationModule;
    }

    part def SupervisorySubsystem {
        attribute subsystemId : Voltage;
        attribute status : OperationalStatus;

        part supervisor : SupervisoryController;
        part commModule : CommunicationModule;
        part power : ACPowerSupply;
        part battery : BatteryBackup;
    }

    // ─── System Definition ───────────────────────────────────────
    part def IndustrialControlSystem {
        attribute systemId : Voltage;
        attribute systemStatus : OperationalStatus;
        attribute totalMass : Mass;
        attribute operatingTemp : Temperature;
        attribute operatingPressure : Pressure;

        part monitoring : MonitoringSubsystem;
        part actuation : ActuationSubsystem;
        part safety : SafetySubsystem;
        part supervisory : SupervisorySubsystem;
        part mainPower : ACPowerSupply;
        part backupPower : BatteryBackup;
        part backbone : CommunicationModule;
    }

    // ─── Deployment Instance ─────────────────────────────────────
    part plantFloor : IndustrialControlSystem;
}
