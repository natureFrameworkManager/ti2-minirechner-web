// Connection to the memory broadcast channel
const memBC = new BroadcastChannel("memory-channel"); 

let regs = [0, 0, 0, 0, 0, 0, 0, 0];
let mrgAddrA = 0;
let mrgAddrB = 0;
let mrgWE = false;
let mrgWS = false;
let mAluIA = false;
let mAluIB = false;
let mAluS = 0;
let F = 0;
let CO = false;
let ZO = false;
let NO = false;
let mChFlg = false;
let CF = false;
let ZF = false;
let NF = false;

let currentAddr = 0;
let nAddr = 0;
let mAddrCtr = 0;

let busEn = false;
let busWr = false;

let MPRAM = new Array(32).fill(new Array(25).fill(0).join('')); // 32 x 25 Bit
MPRAM[0] = "0000000110000000010101010"; // Example Instruction

// Data RAM (00-EF)
let DPRAM = new Array(0xEF +1).fill("00000000"); // 0x00 - 0xEF
let inputs = {"ff": 0b00000000, "fe": 0b00000000, "fd": 3, "fc": 7}; // 4 Inputs
let outputs = {"ff": 0b00000000, "fe": 0b00000000}; // 2 Outputs

memBC.onmessage = (ev) => {
    if (ev.data.msg === "request-state") {
        memBC.postMessage({msg: "state", data: DPRAM});
    }
}

function parseCodeInput() {
    let codeInput = document.querySelector("#code-input").value;
    codeInput = codeInput.trim().split('\n');
    codeInput = codeInput.map(line => line.trim().split('#')[0].trim()).filter(line => line.length > 0);
    codeInput = codeInput.map(line => line.replace(/[^(0,1,:)]/g,""));
    codeInput = codeInput.map(line => line.split(':'));

    let addr = new Array(32).fill(false);
    for (let line of codeInput) {
        if (line.length == 2) {
            addr[parseInt(line[0], 2)] = line[1];
        } else if (line.length == 1) {
            addr[addr.indexOf(false)] = line[0];
        } else {
            console.error("Invalid line in code input:", line);
        }
    }
    addr = addr.map(line => line ? line.replace(/ /g, '') : "0000000000000000000000000");
    MPRAM = addr;
}


parseCodeInput();

function setNAddr(value) {
    nAddr = value & 0b11111;
}
function setmAddrCtr(value) {
    mAddrCtr = value & 0b11;
}
function setMrgAddrA(addr) {
    mrgAddrA = addr & 0b111;
}
function setMrgAddrB(addr) {
    mrgAddrB = (addr & 0b1111);
}
function setAluS(value) {
    mAluS = value & 0b1111;
}
function setReg() {
    if (mrgWE) {
        regs[(mrgWS ? mrgAddrB : mrgAddrA)] = F & 0xFF;
    }
}
function setFlags() {
    if (mChFlg) {
        CF = CO;
        ZF = ZO;
        NF = NO;
    }
}

function parseNextInstr() {
    currentAddr = getNextAddr();
    const instr = MPRAM[getNextAddr()].split('');

    setmAddrCtr(parseInt(instr.slice(0, 2).join(''), 2)); // 2-bit microprogram counter
    setNAddr(parseInt(instr.slice(2, 7).join(''), 2)); // 5-bit next address
    busWr = (instr[7] === '1'); // 1-bit bus write
    busEn = (instr[8] === '1'); // 1-bit bus enable
    setMrgAddrA(parseInt(instr.slice(9, 12).join(''), 2)); // 3-bit register A address 
    setMrgAddrB(parseInt(instr.slice(12, 16).join(''), 2)); // 4-bit register B address / immediate value
    mrgWS = (instr[16] === '1'); // 1-bit register write select
    mrgWE = (instr[17] === '1'); // 1-bit register write enable
    mAluIA = (instr[18] === '1'); // 1-bit ALU input A select
    mAluIB = (instr[19] === '1'); // 1-bit ALU input B select
    setAluS(parseInt(instr.slice(20, 24).join(''), 2)); // 4-bit ALU select
    mChFlg = (instr[24] === '1'); // 1-bit change flags
}
function getAddrMux() {
    switch ((mAddrCtr << 1) | (nAddr & 0b1)) {
        case 0b000: return 0; // 0
        case 0b001: return 1; // 1
        case 0b010: return 1; // TODO: EVT1
        case 0b011: return CF; // CF
        case 0b100: return CO; // CO
        case 0b101: return ZO; // ZO
        case 0b110: return NO; // NO
        case 0b111: return 1; // TODO: EVT2
    }
}
function getNextAddr() {
    return (nAddr & 0b11110) | (getAddrMux() ? 1 : 0);
}
function getRegA() {
    return regs[mrgAddrA];
}
function getRegB() {
    return regs[mrgAddrB & 0b111];
}
function getMemAddr() {
    return getRegA();
}
function getBValue() {
    return (mrgAddrB & 0b1111) | (((mrgAddrB & 0b1000) >> 3) ? 0b11111000 : 0);
}
function getAluA() {
    if (mAluIA) {
        return getMemBus();
    } else {
        return getRegA();
    }
}
function getAluB() {
    if (mAluIB) {
        return getBValue();
    } else {
        return getRegB();
    }
}
function getMemBus() {
    if (busEn) {
        if (getMemAddr() > 0x00 && getMemAddr() <= 0xEF) {
            return DPRAM[getMemAddr()];
        }
        if (getMemAddr() >= 0xFC && getMemAddr() <= 0xFF) {
            return inputs[getMemAddr().toString(16)];
        }
    } else {
        return 0b00000000;
    }
}
function setMemBus() {
    if (busEn) {
        if (getMemAddr() > 0x00 && getMemAddr() <= 0xEF) {
            if (busWr) {
                DPRAM[getMemAddr()] = (F & 0xFF);
            }
        }
        if (getMemAddr() >= 0xFE && getMemAddr() <= 0xFF) {
            if (busWr) {
                outputs[getMemAddr().toString(16)] = (F & 0xFF);
            }
        }
    }
    if (busEn && busWr) {
        memBC.postMessage({msg: "update", data: DPRAM});
    }
}
function alu() {
    // AI Genereted Code not fully checked, might contain errors
    // 8-Bit Signed Integer ALU
    const a = getAluA() << 24 >> 24; // signed 8-bit
    const b = getAluB() << 24 >> 24; // signed 8-bit
    let res = 0;
    let carry = false;

    switch (mAluS) {
        case 0b0000: // ADDH: F = A + B, C = Cin OR Ca
            res = a + b;
            carry = (res > 127 || res < -128);
            F = res & 0xFF;
            CO = CO || carry;
            break;
        case 0b0001: // A: F = A, C = 0
            F = a & 0xFF;
            CO = false;
            break;
        case 0b0010: // NOR: F = ~(A | B), C = 0
            F = (~(a | b)) & 0xFF;
            CO = false;
            break;
        case 0b0011: // 0: F = 0, C = 0
            F = 0;
            CO = false;
            break;
        case 0b0100: // ADD: F = A + B, C = Ca
            res = a + b;
            carry = (res > 127 || res < -128);
            F = res & 0xFF;
            CO = carry;
            break;
        case 0b0101: // ADDS: F = A + B + 1, C = !Ca
            res = a + b + 1;
            carry = (res > 127 || res < -128);
            F = res & 0xFF;
            CO = !carry;
            break;
        case 0b0110: // ADC: F = A + B + Cin, C = Ca
            res = a + b + (CF ? 1 : 0);
            carry = (res > 127 || res < -128);
            F = res & 0xFF;
            CO = carry;
            break;
        case 0b0111: // ADCS: F = A + B + !Cin, C = !Ca
            res = a + b + (CF ? 0 : 1);
            carry = (res > 127 || res < -128);
            F = res & 0xFF;
            CO = !carry;
            break;
        case 0b1000: // LSR: F(n) = A(n+1), F(7)=0, C = A(0)
            F = (a >>> 1) & 0x7F;
            CO = (a & 0x01) !== 0;
            break;
        case 0b1001: // RR: F(n) = A(n+1), F(7)=A(0), C = A(0)
            F = ((a >>> 1) | ((a & 0x01) << 7)) & 0xFF;
            CO = (a & 0x01) !== 0;
            break;
        case 0b1010: // RRC: F(n) = A(n+1), F(7)=Cin, C = A(0)
            F = ((a >>> 1) | ((CF ? 1 : 0) << 7)) & 0xFF;
            CO = (a & 0x01) !== 0;
            break;
        case 0b1011: // ASR: F(n) = A(n+1), F(7)=A(7), C = A(0)
            F = ((a >> 1) | (a & 0x80)) & 0xFF;
            CO = (a & 0x01) !== 0;
            break;
        case 0b1100: // B: F = B, C = 0
            F = b & 0xFF;
            CO = false;
            break;
        case 0b1101: // SETC: F = B, C = 1
            F = b & 0xFF;
            CO = true;
            break;
        case 0b1110: // BH: F = B, C = Cin
            F = b & 0xFF;
            CO = CF;
            break;
        case 0b1111: // INVC: F = B, C = !Cin
            F = b & 0xFF;
            CO = !CF;
            break;
    }

    // Interpret F als signed 8-bit für Flags
    const F_signed = (F << 24) >> 24;
    ZO = (F_signed === 0);
    NO = (F_signed < 0);
}

function displayReg() {
    displayMrgAddr();

    document.querySelectorAll(`svg .mrgwe`).forEach(el => el.setAttribute("fill", (mrgWE ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .mrgws`).forEach(el => el.setAttribute("fill", (mrgWS ? "yellow" : "slategray")));

    for (let regnum = 0; regnum < regs.length; regnum++) {
        for (let bit = 0; bit < 8; bit++) {
            document.querySelectorAll(`svg .reg${regnum}${bit}`).forEach(el => el.setAttribute("fill", ((regs[regnum] & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        }
    }
}
function displayAlu() {
    for (let bit = 0; bit < 8; bit++) {
        document.querySelectorAll(`svg .a${bit}`).forEach(el => el.setAttribute("fill", ((getAluA() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .b${bit}`).forEach(el => el.setAttribute("fill", ((getAluB() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .f${bit}`).forEach(el => el.setAttribute("fill", ((F & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }

    document.querySelectorAll(`svg .maluia`).forEach(el => el.setAttribute("fill", (mAluIA ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .maluib`).forEach(el => el.setAttribute("fill", (mAluIB ? "yellow" : "slategray")));

    for (let bit = 0; bit < 4; bit++) {
        document.querySelectorAll(`svg .malus${bit}`).forEach(el => el.setAttribute("fill", ((mAluS & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
        
    document.querySelectorAll(`svg .mchflg`).forEach(el => el.setAttribute("fill", (mChFlg ? "yellow" : "slategray")));
    
    document.querySelectorAll(`svg .cf`).forEach(el => el.setAttribute("fill", (CF ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .zf`).forEach(el => el.setAttribute("fill", (ZF ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .nf`).forEach(el => el.setAttribute("fill", (NF ? "yellow" : "slategray")));
    
    document.querySelectorAll(`svg .co`).forEach(el => el.setAttribute("fill", (CO ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .zo`).forEach(el => el.setAttribute("fill", (ZO ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .no`).forEach(el => el.setAttribute("fill", (NO ? "yellow" : "slategray")));

}
function displayMrgAddr() {
    for (let bit = 0; bit < 3; bit++) {
        document.querySelectorAll(`svg .mrgaa${bit}`).forEach(el => el.setAttribute("fill", ((mrgAddrA & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .mrgab${bit}`).forEach(el => el.setAttribute("fill", ((mrgAddrB & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    document.querySelectorAll(`svg .mrgab3`).forEach(el => el.setAttribute("fill", ((mrgAddrB & 0b1000) !== 0 ? "yellow" : "slategray")));
}
function displayMem() {
    for (let bit = 0; bit < 8; bit++) {
        document.querySelectorAll(`svg .mema${bit}`).forEach(el => el.setAttribute("fill", ((getMemAddr() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .memdi${bit}`).forEach(el => el.setAttribute("fill", ((getMemBus() & (1 << bit)) !== 0 ? "yellow" : "slategray")));
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
}
function displayCtrl() {
    for (let bit = 0; bit < 3; bit++) {
        document.querySelectorAll(`svg .addr${bit+5}`).forEach(el => el.setAttribute("fill", "slategray")); // Run Mode
    }
    for (let bit = 0; bit < 5; bit++) {
        document.querySelectorAll(`svg .na${bit}`).forEach(el => el.setAttribute("fill", ((nAddr & (1 << bit)) !== 0 ? "yellow" : "slategray")));
        document.querySelectorAll(`svg .addr${bit}`).forEach(el => el.setAttribute("fill", ((currentAddr & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    for (let bit = 0; bit < 2; bit++) {
        document.querySelectorAll(`svg .mac${bit}`).forEach(el => el.setAttribute("fill", ((mAddrCtr & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
    document.querySelectorAll(`svg .busen`).forEach(el => el.setAttribute("fill", (busEn ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .buswr`).forEach(el => el.setAttribute("fill", (busWr ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .am1`).forEach(el => el.setAttribute("fill", (getAddrMux() ? "yellow" : "slategray")));
}
function display() {
    displayReg();
    displayMem();
    displayAlu();
    displayCtrl();
    alu();
}

function clk() {
    setFlags();
    setReg();
    setMemBus();
    parseNextInstr();
}

function displayBin8bit(value) {
    return (value >>> 0).toString(2).padStart(8, '0').slice(0, 8);
}

setInterval(display, 10);