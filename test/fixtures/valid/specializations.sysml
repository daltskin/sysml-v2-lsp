// Specializations of usages and definitions (SysML v2 8.2.2.6.1, 8.2.2.6.2):
// typings, subsettings, reference and cross subsettings, redefinitions and
// subclassifications, in each notation, with names spelled like keywords.
package Specializations {
    attribute def Mass;
    attribute def Real;
    item def Fuel;
    port def P;
    port def 'P-1';
    action def A;
    state def S;
    requirement def R;
    use case def U;
    part def Base {
        attribute mass : Mass;
        attribute var : Mass;
        attribute 'specializes' : Mass;
        item item4;
        item item5;
        item item7 [*];
        part engine { part cylinder; }
        action run : A;
        state st : S;
        requirement req : R;
        concern cn;
        use case uc : U;
        port fuelPort : P;
        attribute <m> 'dry mass' : Mass;
        attribute 'a::b' : Mass;
        part 'my engine' { part 'the cylinder'; }
        part 'my.engine' { part 'the cylinder'; }
        attribute <'a'> alpha : Mass;
        attribute <'a.b.'> beta : Mass;
    }
    part def Other;
    part def <Q> 'Quoted Def' :> 'Other Base', Q2;
    part def 'Other Base';
    part def <Q2> Short;
    part def 'a:' { part b; }
    part def '$' { part x; }
    part def 'it\'s';
    flow def Flow;

    // Subclassifications of definitions
    part def Sub1 :> Base;
    part def Sub2 specializes Base, Other;
    abstract part def Sub3 :> Base, Other { part inner :> Base::engine; }
    action def A2 :> A;
    state def S2 specializes S;
    requirement def R2 :> R;
    use case def U2 :> U;

    part p : Base, Other {
        // typings
        attribute t1 : Mass;
        attribute t2 defined by Mass;
        attribute t3 typed by Mass, Real;
        port cp : ~P;
        // subsettings, with a multiplicity in between
        item s1 : Fuel :> item7;
        item s2 [*] subsets item7, item4;
        item s3 :> item7 [0..*] ordered :> item4;
        attribute s4 :> 'specializes';
        attribute s5 :> var;
        // reference and cross subsettings
        attribute rs1 : Mass [*] ::> mass;
        attribute rs2 references mass;
        attribute cs1 => mass;
        attribute cs2 crosses mass;
        // redefinitions, also anonymous
        item r1 : Fuel :>> item4 :>> item5;
        item r2 redefines item4, item5;
        attribute :>> mass = 1500;
        attribute redefines var;
        // feature chains and qualified names
        part c1 :> engine.cylinder;
        part c2 :> Base::engine;
        // quoted names and short names, as targets and as the declaring element
        attribute q1 :> 'dry mass', 'a::b';
        attribute q2 :>> Base::'dry mass';
        part q3 :> 'my engine'.'the cylinder';
        part q6 :> 'my.engine'.'the cylinder';
        part q7 :> 'my.engine';
        port cp2 : ~Specializations::P;
        port cp3 : ~'P-1';
        port cp4 : P::'~P';
        part e1 : 'a:'::b;
        part g1 : $::Specializations::Base;
        part g2 :> $::Specializations::Base.engine;
        part g3 : '$'::x;
        part q8 : 'it\'s';
        attribute sn1 :> 'a';
        attribute sn2 :>> Base::'a.b.';
        attribute <'s.1'> 'n.1' :> alpha;
        attribute <'s2'> :>> beta;
        attribute <q4> 'quoted redefiner' :>> m;
        attribute <q5> :> m;
        attribute 'specializes' :>> 'specializes';
        // all of them mixed, in written order
        item m1 : Fuel subsets item7 references item4 :>> item5 [1];
        // a comment naming redefines item4 or :> item5
        part nested : Base {
            attribute :>> mass;
            item n1 :> item7;
        }
    }

    // Kind-specific declarations
    part q : Base {
        action a1 : A :> run;
        perform action pa :> run;
        perform run :> run;
        perform Base::run;
        exhibit st;
        include uc;
        message m2 from engine to engine;
        state s1 :> st;
        exhibit state es :> st;
        requirement rq :> req;
        satisfy requirement sr :> req;
        use case u1 :> uc;
        include use case iu :> uc;
        port fp :>> fuelPort : ~P;
        constraint c1 { true }
        connection conn :> conn connect engine to engine;
        flow f1 :> f1 of fp : Fuel :> item7 from engine to engine;
        flow f2 : Flow, Flow from engine to engine;
        succession flow f3 :>> f1 from engine to engine;
        message msg :> msg of Fuel;
        allocation al :> al allocate engine to engine;
        interface ifc :> ifc connect fuelPort to fuelPort;
        ref part rp :> engine;
        enum def E { enum e1; }
    }

    // Variants, framed concerns, entry actions and metadata bodies
    variation part def Choice :> Base {
        variant part v1 :> engine;
        variant engine :> item7;
    }
    requirement def R3 :> R {
        frame cn :> cn;
        frame concern fc :> cn;
    }
    metadata def M { attribute level : Real; }
    state def S3 :> S {
        entry action en :> run;
        do run :> run;
    }
    part pm : Base {
        @M { :>> level = 1; }
        metadata M { redefines level = 2; }
    }

    // Inline-owned elements: none of their specializations are the owner's
    state def Machine {
        attribute counter : Real;
        state s0;
        state s9;
        transition t1 first s0 accept sig : Fuel :> item7 then s9;
        transition t3 first s0 do counter then s9;
        transition t2 :> t1 first s0 if { in x : Real :> counter; true } do action eff : A :> eff then s9;
    }
    part def Holder {
        attribute h1 : Real = { in y : Real :> h1; y };
        part d1 [1] : Base;
        connection cn2 connect a ::> d1 to b references d1;
    }
}
