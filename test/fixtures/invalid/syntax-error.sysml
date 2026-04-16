package BrokenModel {
    part def Vehicle {
        attribute mass : Real;
    // Missing closing brace for Vehicle

    part def Engine {
        // Random invalid tokens
        @@@ invalid syntax here %%%
    }
}
