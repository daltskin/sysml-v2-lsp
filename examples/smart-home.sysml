package SmartHome {

    // ─── Attribute Definitions ───
    attribute def Temperature;
    attribute def Percentage;
    attribute def DeviceName;

    enum def DeviceState {
        off;
        on;
        standby;
    }

    // ─── Part Definitions ───
    part def Sensor {
        attribute name : DeviceName;
        attribute deviceState : DeviceState;
    }

    part def Thermostat :> Sensor {
        attribute targetTemp : Temperature;
        attribute currentTemp : Temperature;
    }

    part def LightController {
        attribute brightness : Percentage;
        attribute deviceState : DeviceState;
    }

    part def SecurityCamera :> Sensor {
        attribute resolution : DeviceName;
        attribute isRecording : DeviceState;
    }

    // ─── System Assembly ───
    part def SmartHomeSystem {
        part thermostat : Thermostat;
        part lights : LightController[1..*];
        part cameras : SecurityCamera[2..4];
    }

    // ─── Behavior ───
    action def MonitorHome {
        in item system : SmartHomeSystem;

        action checkTemperature;
        action adjustLights;
        action recordVideo;

        first checkTemperature;
        then adjustLights;
        then recordVideo;
    }
}