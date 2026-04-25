// DFA coverage for advanced SysML v2 constructs
// Ensures the DFA snapshot covers grammar paths not exercised by other
// example files: individual, library package, constructor expressions,
// nonunique, while/for loops, connection def, succession flow,
// textual representation, binding connectors, interaction, and more.

library package DFACoverageLibrary {
  private import ScalarValues::*;

  attribute def Timestamp {
    attribute value : String;
  }

  part def Person {
    attribute name : String;
    attribute dateOfBirth : Timestamp;
  }

  individual part def 'Named Person' :> Person {
    doc /* An individual person with specific identity. */
    attribute dateOfBirth : Timestamp = new Timestamp("2000-01-01");
    attribute dateOfDeath : Timestamp = new Timestamp("2099-12-31");
  }

  individual part def AnotherIndividual :> Person {
    attribute dateOfBirth : Timestamp = new Timestamp("1990-06-15");
  }

  part def Container {
    attribute items : String[*] nonunique;
  }

  part def SystemConfig {
    attribute values : Real[*] nonunique ordered;
  }

  // Stakeholder need with short name
  requirement def <'SN-001'> StakeholderNeed {
    doc /* A stakeholder need requirement. */
    subject s : Person;
  }

  // Unit conversion pattern
  attribute def ForceUnit :> Person {
    attribute :>> name;
  }

  // Refinement dependency
  requirement def HighLevelReq {
    doc /* High level requirement */
  }

  requirement def DetailedReq {
    #refinement dependency from DetailedReq to HighLevelReq;
  }

  // -------------------------------------------------------------------
  // CONNECTION DEFINITION — exercises connectionDefinition grammar rule
  // -------------------------------------------------------------------
  port def SignalPort {
    attribute signalLevel : Real;
  }

  connection def DataLink {
    end source : SignalPort;
    end target : SignalPort;
  }

  part def Transmitter {
    port txPort : SignalPort;
  }

  part def Receiver {
    port rxPort : SignalPort;
  }

  part def CommSystem {
    part tx : Transmitter;
    part rx : Receiver;
    connection link : DataLink connect tx.txPort to rx.rxPort;
  }

  // -------------------------------------------------------------------
  // WHILE LOOP & FOR LOOP — exercises whileLoopNode, forLoopNode
  // -------------------------------------------------------------------
  item def SensorReading {
    attribute value : Real;
    attribute timestamp : Timestamp;
  }

  action def ProcessReadings {
    in item readings : SensorReading[*];
    attribute count : Integer = 0;
    attribute sum : Real = 0.0;

    // While loop: process until threshold reached
    while (sum < 100.0) {
      action accumulate {
        assign sum := sum + 1.0;
        assign count := count + 1;
      }
    }

    // Loop-until variant
    loop {
      action retry;
    } until (count > 10);

    // For loop: iterate over collection
    for reading : SensorReading in readings {
      action processOne;
    }
  }

  // -------------------------------------------------------------------
  // SUCCESSION FLOW — exercises successionFlow / successionFlowUsage
  // -------------------------------------------------------------------
  item def Command;
  item def Response;

  part def RequestHandler {
    out item cmdOut : Command;
  }

  part def ResponseHandler {
    in item rspIn : Response;
  }

  action def HandleRequest {
    action receive;
    action validate;
    action respond;

    succession flow of Command from receive to validate;
    succession flow of Response from validate to respond;
  }

  // -------------------------------------------------------------------
  // BINDING CONNECTOR — exercises bindingConnectorAsUsage
  // -------------------------------------------------------------------
  part def BoundSystem {
    part source {
      port dataPort : SignalPort;
    }
    part mirror {
      port dataPort : SignalPort;
    }
    binding bind source.dataPort = mirror.dataPort;
  }

  // -------------------------------------------------------------------
  // INTERACTION — exercises interaction grammar rule
  // -------------------------------------------------------------------
  interaction def Handshake {
    in item request : Command;
    out item response : Response;
  }

  // -------------------------------------------------------------------
  // TEXTUAL REPRESENTATION — exercises textualRepresentation rule
  // -------------------------------------------------------------------
  part def DocumentedPart {
    doc /* A part with textual representation in another language. */
    rep language "C" /* struct DocumentedPart { int id; } */
  }

  // -------------------------------------------------------------------
  // ANALYSIS CASE — exercises analysisCaseDefinition
  // -------------------------------------------------------------------
  analysis def ThroughputAnalysis {
    subject sys : CommSystem;
    objective throughputObj {
      doc /* Determine maximum throughput under load. */
    }
    in attribute loadFactor : Real;
    return attribute maxThroughput : Real;
  }

  // -------------------------------------------------------------------
  // IF NODE with ELSE — exercises ifNode with else branch
  // -------------------------------------------------------------------
  action def ConditionalProcess {
    attribute threshold : Real = 50.0;
    attribute value : Real;

    if (value > threshold) {
      action highPath;
    } else if (value > 0.0) {
      action lowPath;
    } else {
      action errorPath;
    }
  }

  // -------------------------------------------------------------------
  // TERMINATE NODE — exercises terminateNode
  // -------------------------------------------------------------------
  action def TerminableProcess {
    action work;
    if (false) {
      terminate;
    }
  }

  // -------------------------------------------------------------------
  // MERGE / DECIDE NODES — exercises mergeNode, decisionNode
  // -------------------------------------------------------------------
  action def MergeDecideProcess {
    action start;
    decide;
      if (true) then action pathA;
      if (false) then action pathB;
    merge;
    then action finish;
  }

  // -------------------------------------------------------------------
  // COMMENT ABOUT — exercises comment with ABOUT clause
  // -------------------------------------------------------------------
  comment about Person, Container
    /* These types represent the core domain model entities. */

  // -------------------------------------------------------------------
  // NARY CONNECTOR — exercises naryConnectorPart
  // -------------------------------------------------------------------
  part def ThreeWaySwitch {
    part a { port p : SignalPort; }
    part b { port p : SignalPort; }
    part c { port p : SignalPort; }
    connect (a.p, b.p, c.p);
  }
}
