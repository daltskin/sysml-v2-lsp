package MultiplicityExamples {
  doc /* Demonstrates SysML v2 multiplicity patterns */

  // ── Definitions with multiplicity on features ──────────────

  part def Vehicle {
    part wheels : Wheel[4]; // exactly 4
    part doors : Door[2..5]; // 2 to 5
    part engine : Engine[1]; // exactly 1
    part passengers : Seat[0..*]; // zero or more
    part spareTire : Wheel[0..1]; // optional (0 or 1)
    attribute vin : String[1]; // required attribute
    attribute nicknames : String[*]; // any number
  }

  part def Wheel {
    attribute diameter : Real[1];
    attribute pressure : Real[0..1]; // optional
  }

  part def Door {
    attribute isLocked : Boolean[1];
    port handle : DoorHandle[1];
  }

  part def DoorHandle;

  part def Engine {
    part cylinders : Cylinder[4..12]; // 4 to 12 cylinders
    attribute horsepower : Real[1];
    attribute serialNumbers : String[1..*]; // one or more
  }

  part def Cylinder {
    attribute displacement : Real[1];
  }

  part def Seat {
    attribute isHeated : Boolean[0..1]; // optional feature
  }

  // ── Connections with multiplicity ──────────────────────────

  connection def Axle {
    end leftWheel : Wheel[1];
    end rightWheel : Wheel[1];
  }

  // ── Port definitions with multiplicity ────────────────────

  port def DataPort {
    in item dataIn : DataPacket[1..*];
    out item dataOut : DataPacket[0..*];
  }

  item def DataPacket {
    attribute size : Integer[1];
    attribute payload : String[0..1];
  }

  // ── Interface with directed features ──────────────────────

  interface def VehicleNetwork {
    end source : DataPort[1];
    end destination : DataPort[1..*]; // one or more destinations
  }

  // ── Usage examples with multiplicity ──────────────────────

  part myGarage {
    part cars : Vehicle[0..10]; // up to 10 cars
    part tools : Tool[*]; // any number of tools

    part frontAxle : Axle[1] {
      end leftWheel : Wheel[1];
      end rightWheel : Wheel[1];
    }
  }

  part def Tool {
    attribute name : String[1];
    attribute quantity : Integer[1];
  }

  // ── Requirement with multiplicity ─────────────────────────

  requirement def SafetyReq {
    doc /* Every vehicle must have at least 4 wheels */
    subject vehicle : Vehicle[1];
    attribute testResults : String[1..*]; // at least one test result
  }

  // ── Enumeration ───────────────────────────────────────────

  enum def Color {
    enum red;
    enum blue;
    enum green;
    enum black;
    enum white;
  }

  part def PaintJob {
    attribute primaryColor : Color[1]; // exactly one
    attribute accentColors : Color[0..3]; // up to 3 accent colors
  }
}
