port def PowerPort;
port def SignalPort;

connection def PowerConnection {
    end source : PowerPort;
    end target : PowerPort;
}

connection def DataLink {
    end sender : SignalPort;
    end receiver : SignalPort;
}
