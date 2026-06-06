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
        return (Math.max(ai2, temp) < DAC(org2) ? 0 : 1) // Jumper 9 connects the temperature sensor to same wire as AI2, so the CP2 comparator compares the higher of the two voltages to the DAC output
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
    document.querySelectorAll(`.org1`).forEach(el => el.textContent = org1.toString(2).padStart(8, "0"));
    document.querySelectorAll(`.ao1-v`).forEach(el => el.textContent = DAC(org1).toFixed(2) + "V");
    document.querySelectorAll(`.ai1`).forEach(el => el.value = ai1.toFixed(2));
    document.querySelectorAll(`.org2`).forEach(el => el.textContent = org2.toString(2).padStart(8, "0"));
    document.querySelectorAll(`.ao2-v`).forEach(el => el.textContent = DAC(org2).toFixed(2) + "V");
    document.querySelectorAll(`.ai2`).forEach(el => el.value = ai2.toFixed(2));
    document.querySelectorAll(`.temp`).forEach(el => el.value = temp.toFixed(2));
    document.querySelectorAll(`.uio`).forEach(el => el.value = uioReg.toString(2).padStart(3, "0"));
    document.querySelectorAll(`.irg`).forEach(el => el.value = irg.toString(2).padStart(8, "0"));

    document.querySelectorAll(`svg .cp1`).forEach(el => el.setAttribute("fill", (getCP1() ? "lime" : "slategray")));
    document.querySelectorAll(`svg .cp1_arrow`).forEach(el => el.setAttribute("fill", (getCP1() ? "limegreen" : "dimgray")));
    document.querySelectorAll(`svg .cp2`).forEach(el => el.setAttribute("fill", (getCP2() ? "lime" : "slategray")));
    document.querySelectorAll(`svg .cp2_arrow`).forEach(el => el.setAttribute("fill", (getCP2() ? "limegreen" : "dimgray")));
    document.querySelectorAll(`svg .ao1`).forEach(el => el.setAttribute("fill", "#" + Math.round(mapBrightness(DAC(org1))).toString(16).padStart(2, "0") + "0000"));
    document.querySelectorAll(`svg .ao2`).forEach(el => el.setAttribute("fill", "#" + Math.round(mapBrightness(DAC(org2))).toString(16).padStart(2, "0") + "0000"));
    document.querySelectorAll(`svg .ai2`).forEach(el => el.setAttribute("fill", "#" + Math.round(mapBrightness(J9 ? Math.max(ai2, temp) : ai2)).toString(16).padStart(2, "0") + "0000"));

    document.querySelectorAll(`.led.cp1`).forEach(el => el.style.backgroundColor = (getCP1() ? "yellow" : "slategray"));
    document.querySelectorAll(`.led.cp2`).forEach(el => el.style.backgroundColor = (getCP2() ? "yellow" : "slategray"));
    document.querySelectorAll(`.led.ao1`).forEach(el => el.style.backgroundColor = "#" + Math.round(mapBrightness(DAC(org1))).toString(16).padStart(2, "0") + "0000");
    document.querySelectorAll(`.led.ao2`).forEach(el => el.style.backgroundColor = "#" + Math.round(mapBrightness(DAC(org2))).toString(16).padStart(2, "0") + "0000");
    document.querySelectorAll(`.led.ai2`).forEach(el => el.style.backgroundColor = "#" + Math.round(mapBrightness(J9 ? Math.max(ai2, temp) : ai2)).toString(16).padStart(2, "0") + "0000");

    document.querySelectorAll(`#fan-con svg #Rotor`).forEach(el => el.style.animation = `spin ${mapFanSpeed(DAC(org1))}s linear infinite`);
}

function mapBrightness(number, inMin=0, inMax=2.55, outMin=0x00, outMax=0xFF) {
    number = Math.min(Math.max(number, inMin), inMax);
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

function mapFanSpeed(number) {
    if (number < 0.5) {
        return 0;
    }
    return mapBrightness(number, 0.5, 2.55, 100, 0);
}

setInterval(() => {
    fanCounter = (fanCounter +1) & 0xFF;
}, 0.275)

setInterval(display, 10);