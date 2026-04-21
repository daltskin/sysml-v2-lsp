package SmartHomeSystem {
    doc /* A comprehensive smart home automation system model with deep
     * structural hierarchy, rich type coupling, and extensive documentation.
     * Models sensors, actuators, controllers, subsystems, and the complete
     * home integration with energy, security, climate, and entertainment. */

    // ═══════════════════════════════════════════════════════════
    // ENUMERATIONS
    // ═══════════════════════════════════════════════════════════

    enum def HomeMode {
        doc /* Operating modes for the smart home */
        home; away; sleep; vacation; party; emergency;
    }

    enum def AlertPriority {
        doc /* Alert and notification priority levels */
        info; warning; urgent; critical;
    }

    enum def DeviceStatus {
        doc /* Device operational status */
        online; offline; error; updating; maintenance;
    }

    // ═══════════════════════════════════════════════════════════
    // CORE DATA TYPES
    // ═══════════════════════════════════════════════════════════

    attribute def SensorData {
        doc /* Timestamped sensor measurement with quality metrics */
        attribute value : Real;
        attribute unit : String;
        attribute timestamp : String;
        attribute quality : Real;
        attribute sensorId : String;
        attribute calibrationOffset : Real;
        attribute minThreshold : Real;
        attribute maxThreshold : Real;
        attribute trendSlope : Real;
        attribute sampleCount : Integer;
        attribute isValid : Boolean;
    }

    attribute def DeviceConfig {
        doc /* Unified device configuration combining network, zone, and firmware */
        attribute ipAddress : String;
        attribute macAddress : String;
        attribute gateway : String;
        attribute subnetMask : String;
        attribute zoneId : String;
        attribute zoneName : String;
        attribute floor : Integer;
        attribute firmwareVersion : String;
        attribute autoUpdate : Boolean;
        attribute lastMaintenance : String;
        attribute installDate : String;
    }

    attribute def EnergyData {
        doc /* Energy consumption and production metrics */
        attribute peakWatts : Real;
        attribute standbyWatts : Real;
        attribute dailyKwh : Real;
        attribute monthlyKwh : Real;
        attribute annualCost : Real;
        attribute efficiencyRating : Real;
        attribute carbonFootprint : Real;
        attribute gridContribution : Real;
        attribute demandResponse : Boolean;
        attribute peakHoursUsage : Real;
        attribute offPeakUsage : Real;
    }

    attribute def ScheduleData {
        doc /* Time-based scheduling with recurrence */
        attribute startHour : Integer;
        attribute startMinute : Integer;
        attribute endHour : Integer;
        attribute endMinute : Integer;
        attribute daysActive : String;
        attribute enabled : Boolean;
        attribute repeatWeekly : Boolean;
        attribute priority : AlertPriority;
        attribute overrideAllowed : Boolean;
        attribute lastTriggered : String;
        attribute triggerCount : Integer;
    }

    attribute def NotificationPayload {
        doc /* Notification content with routing metadata */
        attribute content : String;
        attribute priority : AlertPriority;
        attribute timestamp : String;
        attribute acknowledged : Boolean;
        attribute source : String;
        attribute category : String;
        attribute recipientId : String;
        attribute expiresAt : String;
        attribute retryCount : Integer;
        attribute delivered : Boolean;
        attribute channel : String;
    }

    attribute def AccessControl {
        doc /* User authentication and authorization credentials */
        attribute userId : String;
        attribute authMethod : String;
        attribute validFrom : String;
        attribute validUntil : String;
        attribute lastUsed : String;
        attribute failedAttempts : Integer;
        attribute locked : Boolean;
        attribute biometricEnabled : Boolean;
        attribute twoFactorEnabled : Boolean;
        attribute accessZones : String;
        attribute auditTrail : String;
    }

    // ═══════════════════════════════════════════════════════════
    // PORT DEFINITIONS
    // ═══════════════════════════════════════════════════════════

    port def DataPort {
        doc /* Bidirectional data communication port */
        attribute protocol : String;
        attribute bandwidth : Real;
        attribute encrypted : Boolean;
        attribute latency : Real;
        attribute config : DeviceConfig;
    }

    port def SensorPort {
        doc /* Sensor data output with quality metrics */
        attribute reading : SensorData;
        attribute sampleRate : Real;
        attribute resolution : Real;
        attribute calibrated : Boolean;
        attribute config : DeviceConfig;
    }

    port def EnergyPort {
        doc /* Energy flow monitoring port */
        attribute watts : Real;
        attribute voltage : Real;
        attribute current : Real;
        attribute energy : EnergyData;
        attribute gridTied : Boolean;
    }

    // ═══════════════════════════════════════════════════════════
    // ABSTRACT DEVICE BASE
    // ═══════════════════════════════════════════════════════════

    abstract part def SmartDevice {
        doc /* Universal base for all IoT devices with telemetry and lifecycle */
        attribute deviceId : String;
        attribute deviceName : String;
        attribute status : DeviceStatus;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute schedule : ScheduleData;
        attribute notification : NotificationPayload;
        attribute access : AccessControl;
        attribute reading : SensorData;
        attribute lastHeartbeat : String;
        attribute powerConsumption : Real;
        attribute signalStrength : Real;
        attribute uptimeHours : Real;
        attribute errorCount : Integer;

        port dataCom : DataPort;
        port powerIn : EnergyPort;

        state def DeviceLifecycle {
            doc /* Device power and operational lifecycle management */
            state provisioning;
            state initializing;
            state running;
            state sleeping;
            state updating;
            state faulted;
            state decommissioned;

            transition first provisioning then initializing;
            transition first initializing then running;
            transition first running then sleeping;
            transition first sleeping then running;
            transition first running then updating;
            transition first updating then running;
            transition first running then faulted;
            transition first faulted then initializing;
            transition first any then decommissioned;
        }

        constraint powerBudget {
            doc /* Power draw within rated capacity */
            powerConsumption >= 0.0
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SENSOR DEVICES
    // ═══════════════════════════════════════════════════════════

    part def TemperatureSensor :> SmartDevice {
        doc /* Precision temperature and humidity environmental sensor */
        attribute temperature : Real;
        attribute humidity : Real;
        attribute dewPoint : Real;
        attribute heatIndex : Real;
        attribute minRange : Real;
        attribute maxRange : Real;
        attribute trendDirection : String;
        attribute comfortIndex : Real;
        attribute avgReading : SensorData;
        attribute calibration : SensorData;
        attribute outdoorComp : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port sensorOut : SensorPort;

        constraint tempRange {
            doc /* Operating temperature bounds */
            temperature >= minRange and temperature <= maxRange
        }
    }

    part def MotionSensor :> SmartDevice {
        doc /* PIR motion detection with occupancy tracking and analytics */
        attribute motionDetected : Boolean;
        attribute sensitivity : Real;
        attribute detectionRange : Real;
        attribute occupantCount : Integer;
        attribute lastMotionTime : String;
        attribute heatSignature : Real;
        attribute dwellTime : Real;
        attribute activityLevel : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute baselineReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port sensorOut : SensorPort;

        constraint sensitivityBound {
            doc /* Sensitivity calibration limits */
            sensitivity >= 0.1 and sensitivity <= 1.0
        }
    }

    part def AirQualitySensor :> SmartDevice {
        doc /* Multi-pollutant indoor air quality monitoring station */
        attribute pm25 : Real;
        attribute pm10 : Real;
        attribute co2Level : Real;
        attribute vocLevel : Real;
        attribute aqiIndex : Integer;
        attribute ozone : Real;
        attribute radonLevel : Real;
        attribute coLevel : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute baselineReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port sensorOut : SensorPort;

        constraint aqiSafety {
            doc /* Critical air quality thresholds */
            co2Level <= 2000.0 and pm25 <= 150.0
        }
    }

    part def SmokeSensor :> SmartDevice {
        doc /* Dual-sensor smoke and carbon monoxide detector */
        attribute smokeDetected : Boolean;
        attribute coLevel : Real;
        attribute alarmActive : Boolean;
        attribute testMode : Boolean;
        attribute batteryLevel : Real;
        attribute ionizationType : Boolean;
        attribute photoType : Boolean;
        attribute selfTestResult : String;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port sensorOut : SensorPort;

        state def SmokeStates {
            doc /* Smoke detection operational state machine */
            state monitoring;
            state smokeAlert;
            state fireAlert;
            state coAlert;
            state silenced;
            state testing;
            state evacuate;

            transition first monitoring then smokeAlert;
            transition first smokeAlert then fireAlert;
            transition first fireAlert then evacuate;
            transition first monitoring then coAlert;
            transition first smokeAlert then silenced;
            transition first silenced then monitoring;
            transition first monitoring then testing;
            transition first testing then monitoring;
        }
    }

    part def DoorSensor :> SmartDevice {
        doc /* Magnetic contact sensor with tamper detection */
        attribute contactClosed : Boolean;
        attribute tamperDetected : Boolean;
        attribute lastOpenTime : String;
        attribute openDuration : Real;
        attribute openCount : Integer;
        attribute batteryLevel : Real;
        attribute vibrationDetected : Boolean;
        attribute glassBreakDetected : Boolean;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port sensorOut : SensorPort;
    }

    part def WaterSensor :> SmartDevice {
        doc /* Water leak and flood detection with auto-shutoff */
        attribute leakDetected : Boolean;
        attribute waterLevel : Real;
        attribute flowRate : Real;
        attribute freezeRisk : Boolean;
        attribute pipeTemp : Real;
        attribute shutoffConnected : Boolean;
        attribute dailyUsage : Real;
        attribute monthlyUsage : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port sensorOut : SensorPort;
    }

    part def WeatherStation :> SmartDevice {
        doc /* Outdoor weather monitoring with full meteorological suite */
        attribute temperature : Real;
        attribute humidity : Real;
        attribute windSpeed : Real;
        attribute windDirection : String;
        attribute rainfall : Real;
        attribute uvIndex : Real;
        attribute barometric : Real;
        attribute visibility : Real;
        attribute forecast : String;
        attribute windChill : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;

        port sensorOut : SensorPort;
    }

    // ═══════════════════════════════════════════════════════════
    // ACTUATOR DEVICES
    // ═══════════════════════════════════════════════════════════

    part def SmartLight :> SmartDevice {
        doc /* Color-adjustable LED with scenes, groups, and scheduling */
        attribute brightness : Real;
        attribute colorR : Integer;
        attribute colorG : Integer;
        attribute colorB : Integer;
        attribute colorTemperature : Integer;
        attribute lumens : Integer;
        attribute fadeTime : Real;
        attribute groupId : String;
        attribute sceneId : String;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        state def LightStates {
            doc /* Light operational state machine with transitions */
            state off;
            state on;
            state dimming;
            state colorChanging;
            state fadingIn;
            state fadingOut;
            state scheduled;

            transition first off then fadingIn;
            transition first fadingIn then on;
            transition first on then dimming;
            transition first on then colorChanging;
            transition first on then fadingOut;
            transition first fadingOut then off;
            transition first on then scheduled;
        }

        constraint brightnessLimits {
            doc /* Brightness within physical range */
            brightness >= 0.0 and brightness <= 1.0
        }
    }

    part def SmartLock :> SmartDevice {
        doc /* Electronic keyless lock with tamper detection and audit trail */
        attribute isLocked : Boolean;
        attribute autoLockDelay : Integer;
        attribute tamperAlert : Boolean;
        attribute batteryLevel : Real;
        attribute accessCodeCount : Integer;
        attribute lastEntry : String;
        attribute failedAttempts : Integer;
        attribute remoteUnlock : Boolean;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        state def LockStates {
            doc /* Lock mechanism state machine */
            state locked;
            state unlocked;
            state locking;
            state unlocking;
            state jammed;
            state tampered;

            transition first unlocked then locking;
            transition first locking then locked;
            transition first locked then unlocking;
            transition first unlocking then unlocked;
            transition first locking then jammed;
            transition first locked then tampered;
        }
    }

    part def SmartThermostat :> SmartDevice {
        doc /* Learning HVAC controller with multi-zone and scheduling */
        attribute currentTemp : Real;
        attribute targetTemp : Real;
        attribute mode : String;
        attribute humidity : Real;
        attribute scheduleEnabled : Boolean;
        attribute learningEnabled : Boolean;
        attribute awayDetection : Boolean;
        attribute fanSpeed : String;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        state def ThermostatStates {
            doc /* HVAC controller state machine */
            state idle;
            state heating;
            state cooling;
            state fanOnly;
            state eco;
            state emergencyHeat;
            state defrost;

            transition first idle then heating;
            transition first idle then cooling;
            transition first idle then fanOnly;
            transition first heating then idle;
            transition first cooling then idle;
            transition first heating then cooling;
            transition first any then emergencyHeat;
            transition first emergencyHeat then defrost;
            transition first defrost then idle;
        }

        constraint comfortLimits {
            doc /* Comfortable temperature range */
            targetTemp >= 15.0 and targetTemp <= 30.0
        }
    }

    part def SmartVent :> SmartDevice {
        doc /* Motorized HVAC vent for per-room zone control */
        attribute openPercentage : Real;
        attribute airflowRate : Real;
        attribute damperAngle : Real;
        attribute filterStatus : Real;
        attribute pressureDrop : Real;
        attribute noiseLevel : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        constraint ventLimits {
            doc /* Vent opening range */
            openPercentage >= 0.0 and openPercentage <= 100.0
        }
    }

    part def Siren :> SmartDevice {
        doc /* Audible and visual alarm with battery backup */
        attribute active : Boolean;
        attribute volume : Real;
        attribute pattern : String;
        attribute strobeEnabled : Boolean;
        attribute batteryBackup : Boolean;
        attribute soundFrequency : Integer;
        attribute decibelLevel : Real;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    part def SmartValve :> SmartDevice {
        doc /* Motorized water shutoff valve with flow monitoring */
        attribute valveOpen : Boolean;
        attribute flowRate : Real;
        attribute autoShutoff : Boolean;
        attribute pressure : Real;
        attribute leakResponse : Boolean;
        attribute cycleCount : Integer;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    part def SmartSprinkler :> SmartDevice {
        doc /* Weather-aware irrigation zone controller */
        attribute wateringActive : Boolean;
        attribute duration : Integer;
        attribute moistureThreshold : Real;
        attribute rainDelay : Boolean;
        attribute zoneNumber : Integer;
        attribute waterUsage : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    part def SmartOutlet :> SmartDevice {
        doc /* Power-monitoring smart outlet with load tracking */
        attribute powerState : Boolean;
        attribute currentLoad : Real;
        attribute maxLoad : Real;
        attribute overloadProtection : Boolean;
        attribute arcFaultDetection : Boolean;
        attribute childLock : Boolean;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    // ═══════════════════════════════════════════════════════════
    // INFRASTRUCTURE DEVICES
    // ═══════════════════════════════════════════════════════════

    part def WiFiRouter :> SmartDevice {
        doc /* Mesh WiFi router with traffic analysis and security */
        attribute ssid : String;
        attribute band : String;
        attribute maxSpeed : Real;
        attribute connectedClients : Integer;
        attribute securityProtocol : String;
        attribute meshNodes : Integer;
        attribute parentalControls : Boolean;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    part def SmartSpeaker :> SmartDevice {
        doc /* Voice-controlled smart speaker with multi-room audio */
        attribute voiceEnabled : Boolean;
        attribute currentVolume : Real;
        attribute groupId : String;
        attribute intercomEnabled : Boolean;
        attribute wakeWord : String;
        attribute musicPlaying : Boolean;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    part def SmartTV :> SmartDevice {
        doc /* Smart television with streaming and home dashboard */
        attribute screenSize : Real;
        attribute resolution : String;
        attribute smartPlatform : String;
        attribute hdmiInputCount : Integer;
        attribute dashboardEnabled : Boolean;
        attribute cameraEnabled : Boolean;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;
    }

    // ═══════════════════════════════════════════════════════════
    // ENERGY DEVICES
    // ═══════════════════════════════════════════════════════════

    part def SolarPanel :> SmartDevice {
        doc /* Photovoltaic array with orientation tracking */
        attribute ratedPower : Real;
        attribute efficiency : Real;
        attribute currentOutput : Real;
        attribute orientation : String;
        attribute tiltAngle : Real;
        attribute soiling : Real;
        attribute degradation : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port energyOut : EnergyPort;
    }

    part def BatteryStorage :> SmartDevice {
        doc /* Home battery with charge cycle and health management */
        attribute capacity : Real;
        attribute chargeLevel : Real;
        attribute isCharging : Boolean;
        attribute isDischarging : Boolean;
        attribute cycleCount : Integer;
        attribute batteryHealth : Real;
        attribute cellTemp : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port energyIn : EnergyPort;
        port energyOut : EnergyPort;

        state def BatteryStates {
            doc /* Battery operational state machine */
            state idle;
            state charging;
            state discharging;
            state balancing;
            state thermalProtect;
            state fault;

            transition first idle then charging;
            transition first idle then discharging;
            transition first charging then idle;
            transition first discharging then idle;
            transition first charging then balancing;
            transition first balancing then idle;
            transition first any then thermalProtect;
            transition first thermalProtect then idle;
            transition first any then fault;
        }
    }

    part def EVCharger :> SmartDevice {
        doc /* Electric vehicle charging station with smart scheduling */
        attribute chargingActive : Boolean;
        attribute currentPower : Real;
        attribute maxPower : Real;
        attribute vehicleConnected : Boolean;
        attribute chargePercent : Real;
        attribute estimatedCompletion : String;
        attribute sessionEnergy : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port energyIn : EnergyPort;

        state def ChargerStates {
            doc /* EV charger state machine */
            state idle;
            state connected;
            state charging;
            state complete;
            state scheduled;
            state fault;

            transition first idle then connected;
            transition first connected then charging;
            transition first connected then scheduled;
            transition first scheduled then charging;
            transition first charging then complete;
            transition first complete then idle;
            transition first any then fault;
        }
    }

    part def SmartMeter :> SmartDevice {
        doc /* Utility smart meter with demand response */
        attribute currentUsage : Real;
        attribute monthlyUsage : Real;
        attribute peakDemand : Real;
        attribute realTimeData : Boolean;
        attribute demandResponse : Boolean;
        attribute tarifRate : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        port energyIn : EnergyPort;
    }

    // ═══════════════════════════════════════════════════════════
    // DEEPLY NESTED SMART HOME HIERARCHY (depth 1-8)
    // ═══════════════════════════════════════════════════════════

    part def SmartHome {
        doc /* Top-level smart home integrating all subsystems,
         * floors, rooms, and device clusters with deep composition */
        attribute homeMode : HomeMode;
        attribute occupancyStatus : Boolean;
        attribute emergencyActive : Boolean;
        attribute totalDevices : Integer;
        attribute systemHealth : Real;
        attribute totalConsumption : Real;
        attribute solarGeneration : Real;
        attribute gridImport : Real;
        attribute outdoorTemp : Real;
        attribute uptime : Real;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        part hub : SmartThermostat;
        part router : WiFiRouter;
        part meter : SmartMeter;
        part battery : BatteryStorage;
        part solar : SolarPanel;
        part evCharger : EVCharger;
        part weather : WeatherStation;
        part speaker : SmartSpeaker;

        port dataCom : DataPort;

        state def HomeStates {
            doc /* Smart home operating state machine */
            state vacant;
            state occupied;
            state sleeping;
            state awayMode;
            state vacationMode;
            state partyMode;
            state emergency;
            state maintenance;

            transition first vacant then occupied;
            transition first occupied then sleeping;
            transition first sleeping then occupied;
            transition first occupied then awayMode;
            transition first awayMode then vacationMode;
            transition first occupied then partyMode;
            transition first any then emergency;
            transition first emergency then occupied;
            transition first any then maintenance;
        }

        part def Floor {
            doc /* A physical floor level containing rooms, corridors, and infrastructure */
            attribute floorNumber : Integer;
            attribute totalArea : Real;
            attribute roomCount : Integer;
            attribute occupancy : Boolean;
            attribute avgTemp : Real;
            attribute avgHumidity : Real;
            attribute energyUsage : Real;
            attribute securityArmed : Boolean;
            attribute avgReading : SensorData;
            attribute config : DeviceConfig;
            attribute energy : EnergyData;
            attribute notification : NotificationPayload;
            attribute schedule : ScheduleData;
            attribute access : AccessControl;

            part corridorMotion : MotionSensor;
            part fireSensor : SmokeSensor;

            part def Room {
                doc /* An individual room with environmental monitoring and device control */
                attribute roomName : String;
                attribute roomType : String;
                attribute area : Real;
                attribute ceilingHeight : Real;
                attribute windowCount : Integer;
                attribute occupied : Boolean;
                attribute targetTemp : Real;
                attribute currentTemp : Real;
                attribute currentHumidity : Real;
                attribute avgReading : SensorData;
                attribute config : DeviceConfig;
                attribute energy : EnergyData;
                attribute notification : NotificationPayload;
                attribute schedule : ScheduleData;
                attribute access : AccessControl;

                part thermostat : SmartThermostat;
                part motionSensor : MotionSensor;
                part tempSensor : TemperatureSensor;
                part airSensor : AirQualitySensor;
                part speaker : SmartSpeaker;

                part def WallPanel {
                    doc /* Smart wall panel with integrated controls and displays */
                    attribute panelId : String;
                    attribute wallLocation : String;
                    attribute hasDisplay : Boolean;
                    attribute hasMicrophone : Boolean;
                    attribute hasCamera : Boolean;
                    attribute touchEnabled : Boolean;
                    attribute brightness : Real;
                    attribute avgReading : SensorData;
                    attribute config : DeviceConfig;
                    attribute energy : EnergyData;
                    attribute notification : NotificationPayload;
                    attribute schedule : ScheduleData;
                    attribute access : AccessControl;

                    part light : SmartLight;
                    part outlet : SmartOutlet;
                    part dimmerSensor : MotionSensor;

                    part def DeviceCluster {
                        doc /* A logical grouping of devices sharing common control */
                        attribute clusterId : String;
                        attribute clusterName : String;
                        attribute deviceCount : Integer;
                        attribute totalPower : Real;
                        attribute clusterStatus : DeviceStatus;
                        attribute avgLoad : Real;
                        attribute peakLoad : Real;
                        attribute avgReading : SensorData;
                        attribute config : DeviceConfig;
                        attribute energy : EnergyData;
                        attribute notification : NotificationPayload;
                        attribute schedule : ScheduleData;
                        attribute access : AccessControl;

                        part clusterLight : SmartLight;
                        part clusterOutlet : SmartOutlet;
                        part clusterSensor : MotionSensor;

                        part def SensorArray {
                            doc /* Dense sensor array for high-resolution environment mapping */
                            attribute arrayId : String;
                            attribute sensorCount : Integer;
                            attribute spatialResolution : Real;
                            attribute updateFrequency : Real;
                            attribute dataFusionEnabled : Boolean;
                            attribute anomalyDetection : Boolean;
                            attribute avgReading : SensorData;
                            attribute trendReading : SensorData;
                            attribute config : DeviceConfig;
                            attribute energy : EnergyData;
                            attribute notification : NotificationPayload;
                            attribute schedule : ScheduleData;
                            attribute access : AccessControl;

                            part arrayTemp : TemperatureSensor;
                            part arrayMotion : MotionSensor;
                            part arrayAir : AirQualitySensor;

                            part def SensorModule {
                                doc /* Individual sensor module with local processing */
                                attribute moduleId : String;
                                attribute moduleType : String;
                                attribute samplingRate : Real;
                                attribute bufferSize : Integer;
                                attribute edgeCompute : Boolean;
                                attribute compressionRatio : Real;
                                attribute avgReading : SensorData;
                                attribute trendReading : SensorData;
                                attribute baselineReading : SensorData;
                                attribute config : DeviceConfig;
                                attribute energy : EnergyData;
                                attribute notification : NotificationPayload;
                                attribute schedule : ScheduleData;
                                attribute access : AccessControl;

                                port sensorOut : SensorPort;

                                part def ModuleCore {
                                    doc /* Core processing element of sensor module */
                                    attribute coreId : String;
                                    attribute processorType : String;
                                    attribute clockSpeed : Real;
                                    attribute memoryMB : Integer;
                                    attribute storageMB : Integer;
                                    attribute temperature : Real;
                                    attribute powerDraw : Real;
                                    attribute uptime : Real;
                                    attribute avgReading : SensorData;
                                    attribute trendReading : SensorData;
                                    attribute config : DeviceConfig;
                                    attribute energy : EnergyData;
                                    attribute notification : NotificationPayload;
                                    attribute schedule : ScheduleData;
                                    attribute access : AccessControl;

                                    port dataCom : DataPort;

                                    constraint thermalLimit {
                                        doc /* Keep core temperature safe */
                                        temperature <= 85.0
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SECURITY SUBSYSTEM
    // ═══════════════════════════════════════════════════════════

    part def SecuritySystem {
        doc /* Comprehensive integrated security monitoring subsystem */
        attribute armed : Boolean;
        attribute alertLevel : AlertPriority;
        attribute intrusionDetected : Boolean;
        attribute fireDetected : Boolean;
        attribute floodDetected : Boolean;
        attribute panicActivated : Boolean;
        attribute lastEvent : String;
        attribute avgReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        part doorLock : SmartLock;
        part doorSensor : DoorSensor;
        part motionSensor : MotionSensor;
        part smokeSensor : SmokeSensor;
        part waterSensor : WaterSensor;
        part siren : Siren;

        state def SecurityStates {
            doc /* Security system arming states */
            state disarmed;
            state armedStay;
            state armedAway;
            state armedNight;
            state entryDelay;
            state exitDelay;
            state alarmTriggered;
            state panicMode;

            transition first disarmed then exitDelay;
            transition first exitDelay then armedAway;
            transition first disarmed then armedStay;
            transition first disarmed then armedNight;
            transition first armedAway then entryDelay;
            transition first entryDelay then disarmed;
            transition first armedAway then alarmTriggered;
            transition first armedStay then alarmTriggered;
            transition first any then panicMode;
        }

        constraint responseTime {
            doc /* Response within acceptable window */
            intrusionDetected implies alertLevel == AlertPriority::critical
        }
    }

    part def ClimateSystem {
        doc /* Integrated multi-zone HVAC climate management subsystem */
        attribute targetTemp : Real;
        attribute currentTemp : Real;
        attribute currentHumidity : Real;
        attribute outdoorTemp : Real;
        attribute ecoMode : Boolean;
        attribute ventilating : Boolean;
        attribute filtering : Boolean;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        part thermostat : SmartThermostat;
        part tempSensor : TemperatureSensor;
        part humiditySensor : TemperatureSensor;
        part airSensor : AirQualitySensor;
        part vent : SmartVent;

        constraint comfortZone {
            doc /* Comfort temperature and humidity range */
            currentTemp >= 18.0 and currentTemp <= 26.0 and
            currentHumidity >= 30.0 and currentHumidity <= 60.0
        }
    }

    part def EnergySystem {
        doc /* Complete energy production, storage, and optimization subsystem */
        attribute totalConsumption : Real;
        attribute solarGeneration : Real;
        attribute gridImport : Real;
        attribute gridExport : Real;
        attribute batteryLevel : Real;
        attribute costSavings : Real;
        attribute carbonOffset : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        part meter : SmartMeter;
        part solar : SolarPanel;
        part battery : BatteryStorage;
        part evCharger : EVCharger;
        part outlet : SmartOutlet;

        constraint energyBalance {
            doc /* Energy conservation law */
            totalConsumption <= solarGeneration + gridImport
        }

        constraint batteryHealth {
            doc /* Battery operating range */
            batteryLevel >= 0.1 and batteryLevel <= 1.0
        }
    }

    part def IrrigationSystem {
        doc /* Smart weather-aware landscape irrigation subsystem */
        attribute waterUsage : Real;
        attribute scheduleActive : Boolean;
        attribute rainDelay : Boolean;
        attribute frostProtect : Boolean;
        attribute seasonalAdjust : Real;
        attribute avgReading : SensorData;
        attribute trendReading : SensorData;
        attribute config : DeviceConfig;
        attribute energy : EnergyData;
        attribute notification : NotificationPayload;
        attribute schedule : ScheduleData;
        attribute access : AccessControl;

        part sprinkler : SmartSprinkler;
        part valve : SmartValve;
        part weather : WeatherStation;
        part moistureSensor : TemperatureSensor;

        constraint waterLimit {
            doc /* Daily water budget */
            waterUsage <= 500.0
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CONFIGURED INSTANCE
    // ═══════════════════════════════════════════════════════════

    part myHome : SmartHome {
        doc /* A fully configured three-story smart home deployment */
        :>> homeMode = HomeMode::home;
        :>> occupancyStatus = true;
        :>> emergencyActive = false;
        :>> totalDevices = 94;
        :>> systemHealth = 0.98;
    }
}
