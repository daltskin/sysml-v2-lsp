// DFA coverage for advanced SysML v2 constructs
// Ensures the DFA snapshot covers: individual, library package,
// constructor expressions (new), nonunique, etc.

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
}
