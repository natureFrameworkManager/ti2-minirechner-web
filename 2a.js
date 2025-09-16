// TODO: Microcode
// TODO: Parser
// TODO: Asembler
// TODO: Expansion Card (F0-F3)
// TODO: UART (FA-FB)
// TODO: Interrupts
// TODO: Clock Flow
// TODO: Full Controls

let regs = [
    0b00000000, // R0
    0b00000000, // R1
    0b00000000, // R2
    0b00000000, // PC
    0b00000000, // Flags: 0000.IEF.NF.ZF.CF
    0b00000000, // Stackpointer
    0b00000000, // For Microcode
    0b00000000, // For Microcode
];
let CTRL = {
    mChFlg: false, // Store ALU Flags
    mAluS: 0b0000, // ALU Function Select
    mAluIA: false, // ALU Input A Select: true-MEMData, false-Register Addr A
    mAluIB: false, // ALU Input B Select: true-Constant mrgAB, false-Register Addr B
    mrgWE: false, // Write to Register
    mrgWS: false, // Write to Addr A (false) or Addr B (true)
    mrgAA: 0b0000, // Register Addr A Bits 2..0, Bit 3 for Selection between mrgAA or OP
    mrgAB: 0b0000, // Register Addr B Bits 2..0, Bit 3 for Selection between mrgAB or OP
    busEn: false, // Read/Write to Memory Bus 
    busWr: false, // (true) Write to Memory Bus
    nextAddr: 0b00000, // Next Microcode Addr
    mAC: 0b0000 // Next Addr Mode
};
let BR = 0b00000000; // Befehlsregister: NextAddress8...5, OpCode4...0
let IFF2 = false; // Interrupt Flip-Flop
let IFF1 = false; // Interrupt Flip-Flop

let MPRAM = new Array(512).fill(new Array(28).fill(0).join('')); // 512 x 28 Bit

let DPRAM = new Array(0xEF +1).fill("00000000"); // Data RAM (00-EF)

let inputs = {"ff": 0b00000000, "fe": 0b00000000, "fd": 3, "fc": 7}; // 4 Inputs (FC-FF)
let outputs = {"ff": 0b00000000, "fe": 0b00000000}; // 2 Outputs (FE-FF)

function getCF() {
    return (regs[4] & 0b00000001); 
}
function getZF() {
    return (regs[4] & 0b00000010) >> 1;
}
function getNF() {
    return (regs[4] & 0b00000100) >> 2;
}
function getIEF() { // Set by Microcode
    return (regs[4] & 0b00001000) >> 3;
}
function getRegA() {
    if (((CTRL.mrgAA & 0b1000) >> 3) !== 0) {
        return regs[BR & 0b00000011];
    } else {
        return regs[CTRL.mrgAA & 0b0111];
    }
}
function getAluA() {
    if (CTRL.mAluIA) {
        return getMemBusData();
    } else {
        return getRegA();
    }
}
function getAluB() {
    if (CTRL.mAluIB) {
        return (mrgAddrB & 0b1111) | (((mrgAddrB & 0b1000) >> 3) ? 0b11111000 : 0);
    } else {
        if (((CTRL.mrgAB & 0b1000) >> 3) !== 0) {
            return regs[(BR & 0b00001100) >> 2];
        } else {
            return regs[CTRL.mrgAB & 0b0111];
        }
    }
}
function getMemBusData() {
    if (CTRL.busEn) {
        if (getRegA() > 0x00 && getRegA() <= 0xEF) {
            return DPRAM[getRegA()];
        }
        if (getRegA() >= 0xFC && getRegA() <= 0xFF) {
            return inputs[getRegA().toString(16)];
        }
    }
}
function getALU() {
    // 8-Bit Signed Integer ALU
    // Always mask F to 8-Bit
    var a = getAluA() << 24 >> 24; // signed 8-bit
    var b = getAluB() << 24 >> 24; // signed 8-bit
    var res = 0;
    var CO = false;

    switch (CTRL.mAluS) {
        case 0b0000: // ADDH: F = A + B, C = Cin OR Ca
            res = a + b;
            CO = getCF() || (res > 127 || res < -128);
            break;
        case 0b0001: // A: F = A, C = 0
            res = a;
            CO = false;
            break;
        case 0b0010: // NOR: F = ~(A | B), C = 0
            res = (~(a | b));
            CO = false;
            break;
        case 0b0011: // 0: F = 0, C = 0
            res = 0;
            CO = false;
            break;
        case 0b0100: // ADD: F = A + B, C = Ca
            res = a + b;
            CO = (res > 127 || res < -128);
            break;
        case 0b0101: // ADDS: F = A + B + 1, C = !Ca
            res = a + b + 1;
            CO = !(res > 127 || res < -128);
            break;
        case 0b0110: // ADC: F = A + B + Cin, C = Ca
            res = a + b + (getCF() ? 1 : 0);
            CO = (res > 127 || res < -128);
            break;
        case 0b0111: // ADCS: F = A + B + !Cin, C = !Ca
            res = a + b + (getCF() ? 0 : 1);
            CO = !(res > 127 || res < -128);
            break;
        case 0b1000: // LSR: F(n) = A(n+1), F(7)=0, C = A(0)
            res = (a >>> 1) & 0b01111111;
            CO = (a & 0x01) !== 0;
            break;
        case 0b1001: // RR: F(n) = A(n+1), F(7)=A(0), C = A(0)
            res = ((a >>> 1) | ((a & 0x01) << 7));
            CO = (a & 0x01) !== 0;
            break;
        case 0b1010: // RRC: F(n) = A(n+1), F(7)=Cin, C = A(0)
            res = ((a >>> 1) | ((getCF() ? 1 : 0) << 7));
            CO = (a & 0x01) !== 0;
            break;
        case 0b1011: // ASR: F(n) = A(n+1), F(7)=A(7), C = A(0)
            res = ((a >>> 1) | (a & 0b10000000));
            CO = (a & 0x01) !== 0;
            break;
        case 0b1100: // B: F = B, C = 0
            res = b;
            CO = false;
            break;
        case 0b1101: // SETC: F = B, C = 1
            res = b;
            CO = true;
            break;
        case 0b1110: // BH: F = B, C = Cin
            res = b;
            CO = getCF();
            break;
        case 0b1111: // INVC: F = B, C = !Cin
            res = b;
            CO = !getCF();
            break;
    }

    // Interpret F als signed 8-bit für Flags
    var F_signed = (res << 24) >> 24;
    return {"f": res, "co": CO, "zo": (F_signed === 0), "no": (F_signed < 0)};
}
// Steuerwerk
function getAM2() {
    switch (BR & 0b00000011) {
        case 0b00:
            return 1;
        case 0b01:
            return getCF();
        case 0b10:
            return getZF();
        case 0b11:
            return getNF();
    }
}
function getAM1() {
    var ALUresult = getALU();
    switch ((CTRL.mAC & 0b011) << 1 | (CTRL.nextAddr & 0b00001)) {
        case 0b000:
            return 0;
        case 0b001:
            return 1;
        case 0b010:
            return (BR & 0b00000100) >> 2 | getAM2();
        case 0b011:
            return getCF();
        case 0b100:
            return ALUresult.co;
        case 0b101:
            return ALUresult.zo;
        case 0b110:
            return ALUresult.no;
        case 0b111:
            return getIEF() & (getINTL() | IFF1);
    }
}
function getNextAddr() {
    var na8to5 = (BR & 0b11110000);
    var na4to2 = (CTRL.nextAddr & 0b11100);
    var na1 = ((CTRL.mAC & 0b100) !== 0 ? (CTRL.nextAddr & 0b00010) : (BR & 0b00001000) >> 2);

    var na0 = ((CTRL.mAC & 0b100) !== 0 ? getAM1() : (BR & 0b00000100) >> 2);
    return na8to5 | na4to2 | na1 | na0;
}
function getINTL() {
    return false; // TODO
}
function getINTE() {
    return false; // TODO
}

function setReg() {
    if (((CTRL.mrgAA & 0b1000) >> 3) !== 0) {
        var mrgAddrA = BR & 0b00000011;
    } else {
        var mrgAddrA = CTRL.mrgAA & 0b0111;
    }
    if (((CTRL.mrgAB & 0b1000) >> 3) !== 0) {
        var mrgAddrB = (BR & 0b00001100) >> 2;
    } else {
        var mrgAddrB = CTRL.mrgAB & 0b0111;
    }
    var ALUresult = getALU();
    if (CTRL.mrgWE) {
        regs[(CTRL.mrgWS ? mrgAddrB : mrgAddrA)] = ALUresult.f & 0xFF;
    }
    if (CTRL.mChFlg) {
        regs[4] = 0b00000000 | (regs[4] & 0b00001000) | (ALUresult.co << 2) | (ALUresult.zo << 1) || (ALUresult << 0)
    }
}
// Steuerwerk
function setBR() {
    if ((CTRL.mAC & 0b0001) && ((CTRL.mAC & 0b0100) >> 2)) {
        BR = getMemBusData();
    } 
}
function resetBR() {
    if (((CTRL.mAC & 0b0010) >> 1) && ((CTRL.mAC & 0b0100) >> 2)) {
        BR = 0b00000000;
    } 
}
function setIFF2() {
    IFF2 = IFF1 && (((CTRL.mAC & 0b0010) >> 1) & (CTRL.mAC & 0b0001) & (CTRL.nextAddr & 0b00001));
}
function resetIFF1() {
    if (IFF2) {
        IFF1 = false;
    }
}

function display() {
    document.querySelectorAll(`svg .mrgwe`).forEach(el => el.setAttribute("fill", (CTRL.mrgWE ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .mrgws`).forEach(el => el.setAttribute("fill", (CTRL.mrgWS ? "yellow" : "slategray")));

    for (let regnum = 0; regnum < regs.length; regnum++) {
        for (let bit = 0; bit < 8; bit++) {
            document.querySelectorAll(`svg .reg${regnum}${bit}`).forEach(el => el.setAttribute("fill", ((regs[regnum] & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        }
    }
    
    for (let bit = 0; bit < 4; bit++) {
        document.querySelectorAll(`svg .mrgaa${bit}`).forEach(el => el.setAttribute("fill", ((CTRL.mrgAA & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .mrgab${bit}`).forEach(el => el.setAttribute("fill", ((CTRL.mrgAB & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    if (((CTRL.mrgAA & 0b1000) >> 3) !== 0) {
        var aa = BR & 0b00000011;
    } else {
        var aa = CTRL.mrgAA & 0b0111;
    }
    if (((CTRL.mrgAB & 0b1000) >> 3) !== 0) {
        var ab = (BR & 0b00001100) >> 2;
    } else {
        var ab = CTRL.mrgAB & 0b0111;
    }
    for (let bit = 0; bit < 3; bit++) {
        document.querySelectorAll(`svg .aa${bit}`).forEach(el => el.setAttribute("fill", ((aa & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .ab${bit}`).forEach(el => el.setAttribute("fill", ((ab & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }

    var ALUresult = getALU();
    for (let bit = 0; bit < 8; bit++) {
        document.querySelectorAll(`svg .a${bit}`).forEach(el => el.setAttribute("fill", ((getAluA() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .b${bit}`).forEach(el => el.setAttribute("fill", ((getAluB() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .f${bit}`).forEach(el => el.setAttribute("fill", ((ALUresult.f & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }

    document.querySelectorAll(`svg .maluia`).forEach(el => el.setAttribute("fill", (CTRL.mAluIA ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .maluib`).forEach(el => el.setAttribute("fill", (CTRL.mAluIB ? "yellow" : "slategray")));

    for (let bit = 0; bit < 4; bit++) {
        document.querySelectorAll(`svg .malus${bit}`).forEach(el => el.setAttribute("fill", ((CTRL.mAluS & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
        
    document.querySelectorAll(`svg .mchflg`).forEach(el => el.setAttribute("fill", (CTRL.mChFlg ? "yellow" : "slategray")));
    
    document.querySelectorAll(`svg .cf`).forEach(el => el.setAttribute("fill", (getCF() ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .zf`).forEach(el => el.setAttribute("fill", (getZF() ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .nf`).forEach(el => el.setAttribute("fill", (getNF() ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .ief`).forEach(el => el.setAttribute("fill", (getIEF() ? "yellow" : "slategray")));
    
    document.querySelectorAll(`svg .co`).forEach(el => el.setAttribute("fill", (ALUresult.co ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .zo`).forEach(el => el.setAttribute("fill", (ALUresult.zo ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .no`).forEach(el => el.setAttribute("fill", (ALUresult.no ? "yellow" : "slategray")));
    
    for (let bit = 0; bit < 8; bit++) {
        document.querySelectorAll(`svg .mema${bit}`).forEach(el => el.setAttribute("fill", ((getRegA() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .memdi${bit}`).forEach(el => el.setAttribute("fill", ((getMemBusData() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    for (let input of Object.keys(inputs)) {
        for (let bit = 0; bit < 8; bit++) {
            document.querySelectorAll(`svg .in${input}${bit}`).forEach(el => el.setAttribute("fill", ((inputs[input] & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        }
    }
    for (let output of Object.keys(outputs)) {
        for (let bit = 0; bit < 8; bit++) {
            document.querySelectorAll(`svg .out${output}${bit}`).forEach(el => el.setAttribute("fill", ((outputs[output] & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        }
    }
    
    document.querySelectorAll(`svg .am1`).forEach(el => el.setAttribute("fill", (getAM1() !== 0 ? "yellow" : "slategray")));
    for (let bit = 0; bit < 9; bit++) {
        var na = ((BR & 0b11110000) << 1) | CTRL.nextAddr;
        document.querySelectorAll(`svg .na${bit}`).forEach(el => el.setAttribute("fill", ((na & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    document.querySelectorAll(`svg .am4`).forEach(el => el.setAttribute("fill", (((getNextAddr() & 0b00000010) >> 1) !== 0 ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .am3`).forEach(el => el.setAttribute("fill", ((getNextAddr() & 0b00000001) !== 0 ? "yellow" : "slategray")));

    for (let bit = 0; bit < 4; bit++) {
        document.querySelectorAll(`svg .mac${bit}`).forEach(el => el.setAttribute("fill", ((CTRL.mAC & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    document.querySelectorAll(`svg .bl1`).forEach(el => el.setAttribute("fill", (((CTRL.mAC & 0b0001) && ((CTRL.mAC & 0b0100) >> 2)) !== 0 ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .bl3`).forEach(el => el.setAttribute("fill", ((((CTRL.mAC & 0b0010) >> 1) && ((CTRL.mAC & 0b0100) >> 2)) !== 0 ? "yellow" : "slategray")));

    document.querySelectorAll(`svg .busen`).forEach(el => el.setAttribute("fill", (CTRL.busEn ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .buswr`).forEach(el => el.setAttribute("fill", (CTRL.busWr ? "yellow" : "slategray")));

    for (let bit = 0; bit < 4; bit++) {
        document.querySelectorAll(`svg .op${bit.toString(2).padStart(2, "0")}`).forEach(el => el.setAttribute("fill", (((BR & 0b00001111) & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }

    document.querySelectorAll(`svg .al1`).forEach(el => el.setAttribute("fill", (((BR & 0b00000100) >> 2 | getAM2()) ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .il2`).forEach(el => el.setAttribute("fill", ((getIEF() & (getINTL() | IFF1)) ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .iff1`).forEach(el => el.setAttribute("fill", (IFF1 ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .iff2`).forEach(el => el.setAttribute("fill", (IFF2 ? "yellow" : "slategray")));
}
function clk() {
    setReg();
    setCTRL();
    setBR();
    resetBR();
    setIFF2();
    resetIFF1();
}
function reset() {
    BR = 0b00000000;
    CTRL = {
        mChFlg: false,
        mAluS: 0b0000,
        mAluIA: false,
        mAluIB: false,
        mrgWE: false,
        mrgWS: false,
        mrgAA: 0b0000,
        mrgAB: 0b0000,
        busEn: false,
        busWr: false,
        nextAddr: 0b00000,
        mAC: 0b0000
    };
    IFF1 = false;
    regs = [
        0b00000000,
        0b00000000,
        0b00000000,
        0b00000000,
        0b00000000,
        0b00000000,
        0b00000000,
        0b00000000,
    ];
}

setInterval(display, 10);