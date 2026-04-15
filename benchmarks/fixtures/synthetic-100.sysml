// Simple 100-line SysML model for benchmark scaling tests
package Synthetic100 {

    attribute def Temperature;
    attribute def Pressure;
    attribute def Voltage;
    attribute def Current;
    attribute def Mass;

    enum def Status {
        active;
        inactive;
        standby;
        error;
    }

    port def PowerPort {
        attribute voltage : Voltage;
        attribute current : Current;
    }

    port def DataPort {
        attribute rate : Voltage;
    }

    part def Sensor {
        attribute id : Voltage;
        attribute status : Status;
        attribute temperature : Temperature;
        port dataOut : DataPort;
    }

    part def Actuator {
        attribute id : Voltage;
        attribute status : Status;
        port powerIn : PowerPort;
        port commandIn : DataPort;
    }

    part def Controller {
        attribute id : Voltage;
        attribute status : Status;
        port powerIn : PowerPort;
        port sensorIn : DataPort;
        port actuatorOut : DataPort;
    }

    part def PowerSupply {
        attribute id : Voltage;
        attribute outputVoltage : Voltage;
        attribute outputCurrent : Current;
        port powerOut : PowerPort;
    }

    part def Module {
        attribute moduleId : Voltage;
        attribute mass : Mass;

        part sensor1 : Sensor;
        part sensor2 : Sensor;
        part actuator1 : Actuator;
        part controller1 : Controller;
        part power1 : PowerSupply;

        interface def SensorLink {
            end source : DataPort;
            end target : DataPort;
        }
    }

    part def Subsystem {
        attribute subsystemId : Voltage;
        attribute status : Status;

        part moduleA : Module;
        part moduleB : Module;
        part mainController : Controller;
        part mainPower : PowerSupply;
    }

    part def System {
        attribute systemId : Voltage;
        attribute systemStatus : Status;
        attribute totalMass : Mass;

        part subsystem1 : Subsystem;
        part subsystem2 : Subsystem;
        part centralController : Controller;
        part centralPower : PowerSupply;
    }

    // Requirements
    part def Requirement1 {
        attribute description : Voltage;
    }

    part def Requirement2 {
        attribute description : Voltage;
    }

    // Top-level instance
    part mainSystem : System;
}
