let org1 = 0b00000000;
let org2 = 0b00000000;
let uioReg = 0b000;
let irg = 0b00000000;

let temp = 0;
let fanCounter = 0;

function readMinibus(addr) {
    if (addr == 0x00) {
        return irg;
    } else if (addr == 0x01) {
        // Status register
    } else if (addr == 0x02) {
        return fanCounter & 0xFF;
    } else if (addr == 0x03) {
        // ISR
    }
}

function writeMinibus(addr, value) {
    if (addr == 0x00) {
        org1 = value;
    } else if (addr == 0x01) {
        org2 = value;
    } else if ((addr & 0b11000000) >>> 6 == 0b00) {
        uioReg = value & 0b00000111;
    } else if ((addr & 0b11000000) >>> 6 == 0b10) {
        // UIO Direction Reg
    } else if ((addr & 0b11000000) >>> 6 == 0b11) {
        // ICR
    } else if (addr == 0x03) {
        // Reset FF in interrupt
    }
}

function DAC(value) {
    var step = (2.55 - 0) / (2**8 -1);
    return step * value
}

setInterval(() => {
    fanCounter = (fanCounter +1) & 0xFF;
}, 0.275)