// Issue #15: end features in interface defs use the plain "end <name>" form.
// The upstream grammar does not include a keyword (port/part/etc.) after "end".

port def PowerPort;
port def SignalPort;

interface def MyIntf1 {
    end port1 : PowerPort;
    end port2 : SignalPort;
}
