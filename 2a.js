// TODO: Asembler
// TODO: Expansion Card (F0-F3)
// TODO: UART (FA-FB)
// TODO: Interrupts
// TODO: Clock Flow
// TODO: Full Controls

// Connection to the memory broadcast channel
const memBC = new BroadcastChannel("memory-channel"); 

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

let currentAddr = 0;

let MPRAM = new Array(512).fill(new Array(28).fill(0).join('')); // 512 x 28 Bit
function fillMicrocode() {
    // Addressed in 16x 32 Bit Blocks
    // 4 Bit for Block selection and 5 Bit for each Block
    // With instruction like for 2i for each control signal

    // Block 0/0b0000
    MPRAM[0b000000000] = "0011 00111 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000000001] = "0011 00111 0 0 1000 0000 0 1 0 1 1100 0".replaceAll(" ", "");
    MPRAM[0b000000010] = "0000 00100 0 0 0100 1000 0 1 0 1 0010 0".replaceAll(" ", "");
    MPRAM[0b000000011] = "0000 00101 0 0 0100 0100 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b000000100] = "0000 00110 0 0 0100 0100 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b000000101] = "0000 00110 0 0 0100 1000 0 1 0 1 0010 0".replaceAll(" ", "");
    MPRAM[0b000000110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b000000111] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");

    MPRAM[0b000010000] = "0000 10001 0 0 0101 1111 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b000010001] = "0000 10010 1 1 0101 0100 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000010010] = "0000 10011 0 0 0101 1111 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b000010011] = "0000 10100 1 1 0101 0011 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000010100] = "0000 10101 0 0 0100 0100 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b000010101] = "0000 10110 0 0 0100 1000 0 1 0 1 0010 0".replaceAll(" ", "");
    MPRAM[0b000010110] = "0000 10111 0 0 0011 0010 0 1 0 1 1100 0".replaceAll(" ", "");
    MPRAM[0b000010111] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    
    // Block 1/0b0001
    MPRAM[0b000100000] = "0000 00100 0 0 1000 0110 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b000100001] = "0000 00110 0 1 0101 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b000100010] = "0000 00100 0 0 0100 0110 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b000100011] = "0000 00111 0 1 0101 0100 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b000100100] = "0000 00101 0 0 0101 1111 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b000100101] = "0011 01001 1 1 0101 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000100110] = "0000 00111 0 0 1000 0110 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000100111] = "0011 01001 0 0 0101 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b000101000] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b000101001] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    MPRAM[0b000110000] = "0011 01001 0 0 1000 0110 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000110001] = "0011 01001 1 1 1000 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000110010] = "0000 10101 1 1 1000 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000110011] = "0000 10100 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b000110100] = "0000 10101 1 1 0111 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b000110101] = "0011 01001 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    
    // Block 2/0b0010
    MPRAM[0b001000000] = "0001 00100 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001000001] = "0001 00100 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001000010] = "0000 00110 0 0 0101 1111 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001000011] = "0000 01010 0 1 0101 0011 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001000100] = "0011 01111 0 0 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001000101] = "0011 01111 0 1 0011 0011 0 1 1 0 0101 0".replaceAll(" ", "");
    MPRAM[0b001000110] = "0000 00111 0 0 0011 0110 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001000111] = "0000 01000 0 0 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001001000] = "0000 01001 1 1 0101 0011 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001001001] = "0011 01111 0 1 0110 0011 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001001010] = "0000 01011 0 0 0101 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001001011] = "0000 01100 0 1 0101 0100 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001001100] = "0000 01110 0 0 0101 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001001101] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001001110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001001111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001010000] = "0000 10110 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001010001] = "0000 10110 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001010010] = "0000 10101 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001010011] = "0000 10100 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001010100] = "0000 10101 0 1 0111 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001010101] = "0000 10110 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001010110] = "0000 10111 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b001010111] = "0011 01111 0 0 0110 0111 0 0 0 0 0101 1".replaceAll(" ", "");
    
    // Block 3/0b0011
    MPRAM[0b001100000] = "0011 00111 0 0 1000 0000 0 1 0 1 0010 1".replaceAll(" ", "");
    MPRAM[0b001100001] = "0000 00100 0 0 1000 0000 0 1 0 1 0010 0".replaceAll(" ", "");
    MPRAM[0b001100010] = "0011 00111 0 0 1000 0000 0 1 0 0 1000 1".replaceAll(" ", "");
    MPRAM[0b001100011] = "0011 00111 0 0 1000 0000 0 1 0 0 1011 1".replaceAll(" ", "");
    MPRAM[0b001100100] = "0011 00111 0 0 1000 0001 0 1 0 1 0100 1".replaceAll(" ", "");
    MPRAM[0b001100101] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001100110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001100111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b001110000] = "0000 10110 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001110001] = "0000 10110 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001110010] = "0000 10101 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001110011] = "0000 10100 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001110100] = "0000 10101 0 1 0111 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b001110101] = "0000 10110 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b001110110] = "0000 10111 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b001110111] = "0000 11000 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b001111000] = "0011 00111 0 0 0110 0111 0 0 0 0 0010 1".replaceAll(" ", "");
    
    // Block 4/0b0100
    MPRAM[0b010000000] = "0011 00111 0 0 1000 0000 0 1 0 0 1010 1".replaceAll(" ", "");
    MPRAM[0b010000001] = "0011 00111 0 0 1000 0001 0 1 0 1 0100 1".replaceAll(" ", "");
    MPRAM[0b010000010] = "0011 00111 0 0 1000 0000 0 0 0 0 0001 1".replaceAll(" ", "");
    MPRAM[0b010000011] = "0000 00011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010000100] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010000101] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010000110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b010000111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010010000] = "0011 00111 0 0 0101 0110 0 1 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b010010001] = "0011 00111 0 0 0100 0110 0 1 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b010010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 5/0b0101
    MPRAM[0b010100000] = "0011 01101 0 0 1000 1110 0 1 0 1 0101 1".replaceAll(" ", "");
    MPRAM[0b010100001] = "0000 00100 0 1 1000 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b010100010] = "0000 00110 0 1 1000 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b010100011] = "0000 01000 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b010100100] = "0000 00101 0 0 0110 1110 0 1 0 1 0101 1".replaceAll(" ", "");
    MPRAM[0b010100101] = "0011 01101 1 1 1000 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010100110] = "0000 00111 0 0 0110 1110 0 1 0 1 0101 1".replaceAll(" ", "");
    MPRAM[0b010100111] = "0000 01011 1 1 1000 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010101000] = "0000 01001 0 1 0111 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b010101001] = "0000 01010 0 0 0110 1110 0 1 0 1 0101 1".replaceAll(" ", "");
    MPRAM[0b010101010] = "0000 01011 1 1 0111 0110 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010101011] = "0011 01101 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b010101100] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b010101101] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b010110000] = "0000 10100 0 0 1000 0110 1 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010110001] = "0000 10110 0 1 1000 0110 1 1 1 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010110010] = "0000 11000 0 1 1000 0110 1 1 1 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010110011] = "0000 11011 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b010110100] = "0000 10101 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010110101] = "0011 01101 0 0 1000 0110 0 1 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b010110110] = "0000 10111 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010110111] = "0011 01101 1 1 1000 0110 0 0 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b010111000] = "0000 11001 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010111001] = "0000 11010 1 1 1000 0110 0 0 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b010111010] = "0011 01101 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b010111011] = "0000 11100 0 1 0111 0110 1 1 1 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010111100] = "0000 11101 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b010111101] = "0000 11110 1 1 0111 0110 0 0 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b010111110] = "0011 01101 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    
    // Block 6/0b0110
    MPRAM[0b011000000] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replaceAll(" ", "");
    MPRAM[0b011000001] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replaceAll(" ", "");
    MPRAM[0b011000010] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replaceAll(" ", "");
    MPRAM[0b011000011] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replaceAll(" ", "");
    MPRAM[0b011000100] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b011000101] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b011001100] = "0000 01101 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011001101] = "0000 01110 0 0 0111 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011001110] = "0000 01111 1 1 1000 0111 0 0 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b011001111] = "0011 00101 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b011010000] = "0000 10100 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b011010001] = "0000 10111 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b011010010] = "0000 01100 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b011010011] = "0000 11010 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b011010100] = "0000 10101 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011010101] = "0000 10110 0 0 0111 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011010110] = "0011 00101 0 0 1000 0111 0 1 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b011010111] = "0000 11000 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011011000] = "0000 11001 0 0 0111 0110 0 1 0 0 0010 0 ".replaceAll(" ", "");
    MPRAM[0b011011001] = "0011 00101 1 1 1000 0111 0 0 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b011011010] = "0000 11011 0 1 0111 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b011011011] = "0000 11100 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011011100] = "0000 11101 0 0 0111 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b011011101] = "0000 11110 0 1 1000 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b011011110] = "0000 11111 1 1 0110 0111 0 0 0 0 1100 1".replaceAll(" ", "");
    MPRAM[0b011011111] = "0011 00101 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    
    // Block 7/0b0111
    MPRAM[0b011100000] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replaceAll(" ", "");
    MPRAM[0b011100001] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replaceAll(" ", "");
    MPRAM[0b011100010] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replaceAll(" ", "");
    MPRAM[0b011100011] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replaceAll(" ", "");
    MPRAM[0b011100100] = " 1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b011100101] = " 0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b011110000] = " 0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b011110001] = " 0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b011110010] = " 0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b011110011] = " 0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 8/0b1000
    MPRAM[0b100000000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100000001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0 ".replaceAll(" ", "");
    MPRAM[0b100000010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100000011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100000100] = "0000 00101 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b100000101] = "0011 00111 0 0 1000 0110 0 1 0 0 0101 1".replaceAll(" ", "");
    MPRAM[0b100000110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b100000111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 9/0b1001
    MPRAM[0b100100000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100100001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100100010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100100011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100100100] = "0000 00101 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b100100101] = "0000 00110 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b100100110] = "0000 00111 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b100100111] = "0000 01000 0 0 0111 0110 0 1 0 0 0010 1".replaceAll(" ", "");
    MPRAM[0b100101000] = "0011 01011 0 0 1000 0111 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100101001] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100101010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b100101011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b100110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 10/0b1010
    MPRAM[0b101000000] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b101000001] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b101000010] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b101000011] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b101000100] = "0000 00101 0 0 0111 1000 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b101000101] = "0000 00110 0 0 0111 0111 0 1 0 0 0010 1".replaceAll(" ", "");
    MPRAM[0b101000110] = "0011 01001 0 0 1000 0111 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101000111] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101001000] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b101001001] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 11/0b1011
    MPRAM[0b101100000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101100001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101100010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101100011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101100100] = "0000 00101 0 0 0111 0000 0 1 0 1 1100 1".replaceAll(" ", "");
    MPRAM[0b101100101] = "0010 00110 0 0 1000 0000 0 1 0 0 1000 0".replaceAll(" ", "");
    MPRAM[0b101100110] = "0010 01001 0 0 1000 0000 0 0 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b101100111] = "0000 00110 0 0 0111 0110 0 1 0 0 0000 1".replaceAll(" ", "");
    MPRAM[0b101101000] = "0000 00101 0 0 0110 0110 0 1 0 0 0000 1".replaceAll(" ", "");
    MPRAM[0b101101001] = "0011 01011 0 0 1000 0111 0 1 0 0 1110 1".replaceAll(" ", "");
    MPRAM[0b101101010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b101101011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b101110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 12/0b1100
    MPRAM[0b110000000] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110000001] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110000010] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110000011] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110000100] = "0000 00110 0 0 0111 0000 0 1 0 1 1100 1".replaceAll(" ", "");
    MPRAM[0b110000101] = "0000 01100 0 0 0111 1111 0 1 0 1 1100 0".replaceAll(" ", "");
    MPRAM[0b110000110] = "0000 00111 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b110000111] = "0010 01000 0 0 1000 0110 0 1 0 0 0101 0".replaceAll(" ", "");
    MPRAM[0b110001000] = "0000 00111 0 0 0111 0001 0 1 0 1 0100 1".replaceAll(" ", "");
    MPRAM[0b110001001] = "0011 01011 0 0 1000 0111 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110001010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b110001011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110001100] = "0000 01001 0 0 0000 0111 0 0 0 0 1101 1".replaceAll(" ", "");
    MPRAM[0b110010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 13/0b1101
    MPRAM[0b110100000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110100001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110100010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110100011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110100100] = "0000 00101 0 0 1000 0111 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b110100101] = "0000 00110 0 0 0111 0111 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b110100110] = "0000 00111 0 0 0110 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b110100111] = "0000 01000 0 0 0111 0110 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b110101000] = "0000 01001 0 0 1000 1000 0 1 0 0 0010 0".replaceAll(" ", "");
    MPRAM[0b110101001] = "0011 01011 0 0 1000 0111 0 1 0 0 0010 1".replaceAll(" ", "");
    MPRAM[0b110101010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b110101011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b110110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 14/0b1110
    MPRAM[0b111000000] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111000001] = "0000 00001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111000010] = "0000 00010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111000011] = "0000 00011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    
    // Block 15/0b1111
    MPRAM[0b111100000] = "0000 00110 0 0 1000 0110 1 1 0 0 0001 0".replaceAll(" ", "");
    MPRAM[0b111100001] = "0000 00110 0 1 1000 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b111100010] = "0000 00101 0 1 1000 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b111100011] = "0000 00100 0 1 1000 0111 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b111100100] = "0000 00101 0 1 0111 0110 1 1 1 0 0001 0".replaceAll(" ", "");
    MPRAM[0b111100101] = "0000 00110 0 0 1000 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b111100110] = "0101 10000 0 1 0011 0001 0 1 0 1 0100 0".replaceAll(" ", "");
    MPRAM[0b111110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
    MPRAM[0b111110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replaceAll(" ", "");
}
fillMicrocode();

let DPRAM = new Array(0xEF +1).fill(0); // Data RAM (00-EF)

// Load 0xFF to R0, Store R0 to (0xA1)
DPRAM[0x00] = 0xFB;
DPRAM[0x01] = 0xFF;
DPRAM[0x02] = 0x10;
DPRAM[0x03] = 0xF0;
DPRAM[0x04] = 0x1F;
DPRAM[0x05] = 0xA1;

let inputs = {"ff": 0b00000000, "fe": 0b00000000, "fd": 0b00000000, "fc": 0b00000000}; // 4 Inputs (FC-FF)
let outputs = {"ff": 0b00000000, "fe": 0b00000000}; // 2 Outputs (FE-FF)

memBC.onmessage = (ev) => {
    if (ev.data.msg === "request-state") {
        memBC.postMessage({msg: "state", data: DPRAM});
    }
}

/**
 * 
 * @param {String} asm 
 * @returns 
 */
function parseASM(asm) {
    let addr = 0;
    let output = [];
    let labels = {};

    var lines = asm.split("\n");
    if (lines[0] != "#! mrasm") { // Check for asm identifier
        return false;
    }
    lines = lines.map(line => line.toUpperCase()) // ignore lower or upper case
    lines = lines.slice(1).map(line => line.trim()).filter((line) => (!(line == "" || line.startsWith(";")))); // Filter empty and comment lines and remove all spaces and tabs
    lines = lines.map(line => line.split(";")[0].trim()) // remove everything behind semicolon as it is a comment
    // Find all labels
    for (const line of lines) {
        if (/\s+\,|\s+\:/.test(line)) {
            console.error("Error with line: ", line);
            continue;
        }
        var split = line.split(/\,\s+|\,|\s+/g)
        if (line.startsWith(".")) {
            // Assembler control relevant for genereted code
            if (split[0].slice(1) == "EQU") {
                if (split.length != 3) {
                    console.error("No parameter match")
                    continue;
                }
                if (split[0].startsWith("R") || split[0].startsWith("PC")) {
                    console.error("Invalid label name");
                    continue;
                }
                labels[split[1]] = parseASMNumber(split[2]);
            }
        } else if (split[0].endsWith(":")) {
            // Label
            if (split[0].startsWith("R") || split[0].startsWith("PC")) {
                console.error("Invalid label name");
                continue;
            }
            if (split.length != 1) {
                console.error("No parameter allowed")
                continue;
            }
            labels[split[0].slice(0, split[0].length-1)] = null;
        }
    }
    // Parse code
    for (const line of lines) {
        if (/\s+\,|\s+\:/.test(line)) {
            console.error("Error with line: ", line);
            continue;
        }
        var split = line.split(/\,\s+|\,|\s+/g)
        if (line.startsWith("*")) {
            // Assembler control not for genereted code relevant
        } else if (line.startsWith(".")) {
            // Assembler control relevant for genereted code
            switch (split[0].slice(1)) {
                case "ORG":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    addr = parseASMNumber(split[1]);
                    break;
                case "BYTE":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    addr += parseASMNumber(split[1]);
                    break;
                case "DB":
                    if (!(split.length >= 2)) {
                        console.error("No parameter match")
                        continue;
                    }
                    for (const byte of split.slice(1)) {
                        output[addr++] = (parseASMNumber(byte) & 0xFF);
                    }
                    break;
                case "DW":
                    if (!(split.length >= 2)) {
                        console.error("No parameter match")
                        continue;
                    }
                    for (const byte of split.slice(1)) {
                        output[addr] = ((0xFF00 & parseASMNumber(byte)) >> 8);
                        output[addr+1] = (0xFF & parseASMNumber(byte));
                        addr += 2;
                    }
                    break;
                case "EQU":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (split[0].startsWith("R") || split[0].startsWith("PC")) {
                        console.error("Invalid label name");
                        continue;
                    }
                    labels[split[1]] = parseASMNumber(split[2]);
                    break;
            }
        } else if (split[0].endsWith(":")) {
            // Label
            if (split[0].startsWith("R") || split[0].startsWith("PC")) {
                console.error("Invalid label name");
                continue;
            }
            if (split.length != 1) {
                console.error("No parameter allowed")
                continue;
            }
            labels[split[0].slice(0, split[0].length-1)] = addr;
        } else {
            // machine code or error
            switch (split[0]) {
                case "CLR":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00000100 | (parseInt(split[1][1]));
                    break;
                case "ADD":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b01100000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "ADC":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b01110000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "SUB":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b10000000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "MUL":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b10110000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "DIV":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b11000000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "INC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b01000100 | (parseInt(split[1][1]));
                    break;
                case "DEC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (/^R[0-2]$/.test(split[1])) {
                        output[addr++] = 0b01010000 | (parseInt(split[1][1]));
                    } else {
                        output[addr++] = 0b01011111;
                        output[addr++] = split[1];
                    } // TODO: handle not addr or label
                    break;
                case "NEG":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00110100 | (parseInt(split[1][1]));
                    break;
                case "AND":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b10010000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "OR":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b10100000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "XOR":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]) && /^R[0-2]$/.test(split[2]))) {
                        console.error("No register as parameters")
                        continue;
                    }
                    output[addr++] = 0b11010000 | (parseInt(split[2][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "COM":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00110000 | (parseInt(split[1][1]));
                    break;
                case "LSR":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00111000 | (parseInt(split[1][1]));
                    break;
                case "ASR":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00111100 | (parseInt(split[1][1]));
                    break;
                case "LSL":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b01100000 | (parseInt(split[1][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "RRC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b01000000 | (parseInt(split[1][1]));
                    break;
                case "RLC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b01110000 | (parseInt(split[1][1]) << 2) | (parseInt(split[1][1]));
                    break;
                case "BITS":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[2].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) && split[1].startsWith("(") && split[1].endsWith("(")) || // (addr) and no const as src
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for sourc", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[2])) {
                            output[addr++] = 0b11110000 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[2])) {
                            output[addr++] = 0b11110100 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[2])) {
                            output[addr++] = 0b11111000 | (parseInt(split[2][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[2])) {
                            output[addr++] = 0b11111100 | (parseInt(split[2][1]));
                        }
                    } else if (split[2].startsWith("(") && split[2].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[2].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[2].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2])) {
                            output[addr++] = parseASMNumber(split[2]);
                        } else {
                            output[addr++] = split[2];
                        }
                    }
                    // src
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b01010000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b01010100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b01011000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b01011100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b01011111; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        console.error("No register or address as first parameter")
                        continue;
                    }
                    break;
                case "BITC":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[2].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) && split[1].startsWith("(") && split[1].endsWith("(")) || // (addr) and no const as src
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for sourc", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[2])) {
                            output[addr++] = 0b11110000 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[2])) {
                            output[addr++] = 0b11110100 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[2])) {
                            output[addr++] = 0b11111000 | (parseInt(split[2][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[2])) {
                            output[addr++] = 0b11111100 | (parseInt(split[2][1]));
                        }
                    } else if (split[2].startsWith("(") && split[2].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[2].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[2].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2])) {
                            output[addr++] = parseASMNumber(split[2]);
                        } else {
                            output[addr++] = split[2];
                        }
                    }
                    // src
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b01100000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b01100100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b01101000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b01101100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b01101111; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        console.error("No register or address as first parameter")
                        continue;
                    }
                    break;
                case "TST":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b01001000 | (parseInt(split[1][1]));
                    break;
                case "CMP":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[2].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) && split[1].startsWith("(") && split[1].endsWith("(")) || // (addr) and no const as src
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for sourc", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[2])) {
                            output[addr++] = 0b11110000 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[2])) {
                            output[addr++] = 0b11110100 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[2])) {
                            output[addr++] = 0b11111000 | (parseInt(split[2][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[2])) {
                            output[addr++] = 0b11111100 | (parseInt(split[2][1]));
                        }
                    } else if (split[2].startsWith("(") && split[2].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[2].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[2].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2])) {
                            output[addr++] = parseASMNumber(split[2]);
                        } else {
                            output[addr++] = split[2];
                        }
                    }
                    // src
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b00100000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b00100100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b00101000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b00101100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b00101111; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        console.error("No register or address as first parameter")
                        continue;
                    }
                    break;
                case "BITT":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[2].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) && split[1].startsWith("(") && split[1].endsWith("(")) || // (addr) and no const as src
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for sourc", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[2])) {
                            output[addr++] = 0b11110000 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[2])) {
                            output[addr++] = 0b11110100 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[2])) {
                            output[addr++] = 0b11111000 | (parseInt(split[2][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[2])) {
                            output[addr++] = 0b11111100 | (parseInt(split[2][1]));
                        }
                    } else if (split[2].startsWith("(") && split[2].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[2].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[2].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2])) {
                            output[addr++] = parseASMNumber(split[2]);
                        } else {
                            output[addr++] = split[2];
                        }
                    }
                    // src
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b00110000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b00110100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b00111000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b00111100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b00111111; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        console.error("No register or address as first parameter")
                        continue;
                    }
                    break;
                case "MOV":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[2].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) && split[1].startsWith("(") && split[1].endsWith("(")) || // (addr) and no const as src
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for sourc", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[2])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[2])) {
                            output[addr++] = 0b11110000 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[2])) {
                            output[addr++] = 0b11110100 | (parseInt(split[2][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[2])) {
                            output[addr++] = 0b11111000 | (parseInt(split[2][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[2])) {
                            output[addr++] = 0b11111100 | (parseInt(split[2][1]));
                        }
                    } else if (split[2].startsWith("(") && split[2].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[2].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[2].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2])) {
                            output[addr++] = parseASMNumber(split[2]);
                        } else {
                            output[addr++] = split[2];
                        }
                    }
                    // src
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b00010000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b00010100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b00011000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b00011100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b00011111; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        console.error("No register or address as first parameter")
                        continue;
                    }
                    break;
                case "LDSP":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b11110000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b11110100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b11111000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b11111100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1])) {
                            output[addr++] = parseASMNumber(split[1]);
                        } else {
                            output[addr++] = split[1];
                        }
                    }
                    output[addr++] = 0b01000000;
                    break;
                case "LDFR":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(
                        /^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1]) || // Rn, (Rn), (Rn+), ((Rn+))
                        /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")) || // const, (addr)
                        Object.keys(labels).includes(split[1].replaceAll(/[\(\)]/g, "")) // label
                    )) {
                        console.error("No register, const, addr or valid label as parameter for destination", line)
                        continue;
                    }
                    // dst
                    if (/^(|\(|\(\()R[0-2](|\)|\+\)|\+\)\))$/.test(split[1])) {
                        // Rn, (Rn), (Rn+), ((Rn+))
                        if (/^R[0-2]$/.test(split[1])) {
                            output[addr++] = 0b11110000 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\)$/.test(split[1])) {
                            output[addr++] = 0b11110100 | (parseInt(split[1][1]));
                        } else if (/^\(R[0-2]\+\)$/.test(split[1])) {
                            output[addr++] = 0b11111000 | (parseInt(split[1][1]));
                        } else if (/^\(\(R[0-2]\+\)\)$/.test(split[1])) {
                            output[addr++] = 0b11111100 | (parseInt(split[1][1]));
                        }
                    } else if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1])) {
                            output[addr++] = parseASMNumber(split[1]);
                        } else {
                            output[addr++] = split[1];
                        }
                    }
                    output[addr++] = 0b01000100;
                    break;
                case "JMP":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (split[1].startsWith("(") && split[1].endsWith(")")) {
                        // (addr)
                        output[addr++] = 0b11111111; // ((PC+)) = ((R3+))
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        // const
                        output[addr++] = 0b11111011; // (PC+) = (R3+)
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1])) {
                            output[addr++] = parseASMNumber(split[1]);
                        } else {
                            output[addr++] = split[1];
                        }
                    }
                    output[addr++] = 0b00010011;
                    break;
                case "LD":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as first parameter")
                        continue;
                    }
                    if (split[2].startsWith("(") && split[2].endsWith(")")) {
                        output[addr++] = 0b11111111;
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2].replaceAll(/[\(\)]/g, ""))) {
                            output[addr++] = parseASMNumber(split[2].replaceAll(/[\(\)]/g, ""));
                        } else {
                            output[addr++] = split[2].replaceAll(/[\(\)]/g, "");
                        }
                    } else {
                        output[addr++] = 0b11111011;
                        if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[2])) {
                            output[addr++] = parseASMNumber(split[2]);
                        } else {
                            output[addr++] = split[2];
                        }
                    }
                    output[addr++] = 0b00010000 | (parseInt(split[1][1]));
                    break;
                case "ST":
                    if (split.length != 3) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[2]))) {
                        console.error("No register as second parameter")
                        continue;
                    }
                    if (!(split[1].startsWith("(") && split[1].endsWith(")"))) {
                        console.error("No address as first parameter")
                        continue;
                    }
                    output[addr++] = 0b11110000 | (parseInt(split[2][1]));
                    output[addr++] = 0b00011111;
                    console.log(split[1], split[1].replaceAll(/[\(\)]/g, ""), parseASMNumber(split[1].replaceAll(/[\(\)]/g, "")), /^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, "")))
                    if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1].replaceAll(/[\(\)]/g, ""))) {
                        output[addr++] = parseASMNumber(split[1].replaceAll(/[\(\)]/g, ""));
                    } else {
                        output[addr++] = split[1].replaceAll(/[\(\)]/g, "");
                    }
                    break;
                case "PUSH":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00010000 | (parseInt(split[1][1]));
                    break;
                case "POP":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    if (!(/^R[0-2]$/.test(split[1]))) {
                        console.error("No register as parameter")
                        continue;
                    }
                    output[addr++] = 0b00010100 | (parseInt(split[1][1]));
                    break;
                case "PUSHF":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00011000;
                    break;
                case "POPF":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00011100;                    
                    break;
                case "JCS":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b001; // Condition
                    output[addr++] = split[1];
                    break;
                case "JCC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b101; // Condition
                    output[addr++] = split[1];
                    break;
                case "JZS":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b010; // Condition
                    output[addr++] = split[1];
                    break;
                case "JZC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b110; // Condition
                    output[addr++] = split[1];
                    break;
                case "JNS":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b011; // Condition
                    output[addr++] = split[1];
                    break;
                case "JNC":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b111; // Condition
                    output[addr++] = split[1];
                    break;
                case "JR":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00100000 | 0b000; // Condition
                    output[addr++] = split[1];
                    break;
                case "CALL":
                    if (split.length != 2) {
                        console.error("No parameter match")
                        continue;
                    }
                    output[addr++] = 0b00101000;
                    if (/^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$/.test(split[1])) {
                        output[addr++] = parseASMNumber(split[1]);
                    } else {
                        output[addr++] = split[1];
                    }
                    break;
                case "RET":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00010111;
                    break;
                case "RETI":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00101100;
                    break;
                case "STOP":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00000001;
                    break;
                case "NOP":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00000010;
                    break;
                case "EI":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00001000;
                    break;
                case "DI":
                    if (split.length != 1) {
                        console.error("No parameter allowed")
                        continue;
                    }
                    output[addr++] = 0b00001100;
                    break;
            
                default:
                    console.error("CMD not known")
                    continue;
            }
        }
    }
    // Replace labels
    for (let index = 0; index < output.length; index++) {
        const exec = output[index];
        if (typeof exec == "string") {
            if (Object.keys(labels).includes(exec)) {
                output[index] = labels[exec];
            } else {
                console.error("Unknown label or const");
                continue;
            }
        }
    }
    return output.map(el => el);
}

/**
 * 
 * @param {String} string 
 * @returns 
 */
function parseASMNumber(string) {
    if (/^0B[0-1]+$/.test(string)) {
        return parseInt(string.slice(2), 2);
    } else if (/^0X([0-9]|[A-F])+$/.test(string)) {
        return parseInt(string.slice(2), 16);
    } else if (/^[0-9]+$/.test(string)) {
        return parseInt(string);
    }
}

/**
 * 
 * @param {String} string Rn, (Rn), (Rn+), ((Rs+)), const, (addr)
 * @returns 
 */
function parseASMTarget(string) {
    if (string.startsWith("0B")) {
        return parseInt(string.slice(2), 2);
    } else if (string.startsWith("0X")) {
        return parseInt(string.slice(2), 16);
    } else {
        return parseInt(string);
    }
}

console.log(parseASM(document.querySelector("#a-con #code-input").textContent))
var tram = parseASM(document.querySelector("#a-con #code-input").textContent);
for (let index = 0; index < 0xEF +1; index++) {
    if (tram[index] === undefined) {
        tram[index] = 0;
    }
}
DPRAM = tram;

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
        return (CTRL.mrgAB & 0b1111) | (((CTRL.mrgAB & 0b1000) >> 3) ? 0b11111000 : 0);
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
        if (getRegA() >= 0x00 && getRegA() <= 0xEF) {
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
            return (BR & 0b00000100) >> 2 ^ getAM2();
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
    var na8to5 = (BR & 0b11110000) << 1;
    var na4to2 = (CTRL.nextAddr & 0b11100);
    var na1 = ((CTRL.mAC & 0b100) === 0 ? (CTRL.nextAddr & 0b00010) : (BR & 0b00001000) >> 2);

    var na0 = ((CTRL.mAC & 0b100) === 0 ? getAM1() : (BR & 0b00000100) >> 2);
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
function setMemBus() {
    if (CTRL.busEn) {
        if (getRegA() > 0x00 && getRegA() <= 0xEF) {
            if (CTRL.busWr) {
                DPRAM[getRegA()] = (getALU().f & 0xFF);
            }
        }
        if (getRegA() >= 0xFE && getRegA() <= 0xFF) {
            if (CTRL.busWr) {
                outputs[getRegA().toString(16)] = (getALU().f & 0xFF);
            }
        }
    }
    if (CTRL.busEn && CTRL.busWr) {
        memBC.postMessage({msg: "update", data: DPRAM});
    }
}
// Steuerwerk
function setCTRL() {
    currentAddr = getNextAddr();
    const instr = MPRAM[getNextAddr()].split('');

    CTRL.mAC = parseInt(instr.slice(0, 4).join(''), 2); // 4-bit microprogram counter
    CTRL.nextAddr = parseInt(instr.slice(4, 9).join(''), 2); // 5-bit next address
    CTRL.busWr = (instr[9] === '1'); // 1-bit bus write
    CTRL.busEn = (instr[10] === '1'); // 1-bit bus enable
    CTRL.mrgAA = parseInt(instr.slice(11, 15).join(''), 2); // 4-bit register A address 
    CTRL.mrgAB = parseInt(instr.slice(15, 19).join(''), 2); // 4-bit register B address / immediate value
    CTRL.mrgWS = (instr[19] === '1'); // 1-bit register write select
    CTRL.mrgWE = (instr[20] === '1'); // 1-bit register write enable
    CTRL.mAluIA = (instr[21] === '1'); // 1-bit ALU input A select
    CTRL.mAluIB = (instr[22] === '1'); // 1-bit ALU input B select
    CTRL.mAluS = parseInt(instr.slice(23, 27).join(''), 2); // 4-bit ALU select
    CTRL.mChFlg = (instr[28] === '1'); // 1-bit change flags
}
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

    document.querySelectorAll(`svg .al1`).forEach(el => el.setAttribute("fill", (((BR & 0b00000100) >> 2 ^ getAM2()) ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .il2`).forEach(el => el.setAttribute("fill", ((getIEF() & (getINTL() | IFF1)) ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .iff1`).forEach(el => el.setAttribute("fill", (IFF1 ? "yellow" : "slategray")));
    document.querySelectorAll(`svg .iff2`).forEach(el => el.setAttribute("fill", (IFF2 ? "yellow" : "slategray")));

    for (let bit = 0; bit < 9; bit++) {
        document.querySelectorAll(`svg .addr${bit}`).forEach(el => el.setAttribute("fill", ((currentAddr & (1 << bit)) !== 0 ? "yellow" : "slategray")));
    }
}
function clk() {
    setReg();
    setMemBus();
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