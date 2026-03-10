let org1 = 0b00000000;
let org2 = 0b00000000;
let uioReg = 0b000;
let irg = 0b00000000;

let ai1 = 0;
let ai2 = 0;
let J9 = false;

let temp = 0;
let fanCounter = 0;

function getCP1() {
    return (ai1 < DAC(org1) ? 0 : 1) 
}

function getCP2() {
    if (J9) {
        return (ai2 < DAC(org2) ? 0 : 1) 
    } else {
        return (temp < DAC(org2) ? 0 : 1) 
    }
}

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

// https://en.wikipedia.org/wiki/Resistor_ladder#Voltage_Mode
function DAC(value) {
    value = value & 0xFF;
    const Vref = 2.55;
    return Vref * (value/(2**8))
}

function display() {
    document.querySelectorAll(`svg .org1`).forEach(el => el.textContent = org1.toString(2).padStart(8, "0"));
    document.querySelectorAll(`svg .ao1-v`).forEach(el => el.textContent = DAC(org1).toFixed(2) + "V");
    document.querySelectorAll(`svg .org2`).forEach(el => el.textContent = org2.toString(2).padStart(8, "0"));
    document.querySelectorAll(`svg .ao2-v`).forEach(el => el.textContent = DAC(org2).toFixed(2) + "V");
    document.querySelectorAll(`svg .irg`).forEach(el => el.textContent = irg.toString(2).padStart(8, "0"));

    document.querySelectorAll(`svg .cp1`).forEach(el => el.setAttribute("fill", (getCP1() ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .cp2`).forEach(el => el.setAttribute("fill", (getCP2() ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .ao1`).forEach(el => el.setAttribute("fill", "#" + Math.round(mapBrightness(DAC(org1))).toString(16).padStart(2, "0") + "0000"));
    document.querySelectorAll(`svg .ao2`).forEach(el => el.setAttribute("fill", "#" + Math.round(mapBrightness(DAC(org2))).toString(16).padStart(2, "0") + "0000"));
}

function mapBrightness(number, inMin=0, inMax=2.55, outMin=0x00, outMax=0xFF) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

setInterval(() => {
    fanCounter = (fanCounter +1) & 0xFF;
}, 0.275)

setInterval(display, 10);