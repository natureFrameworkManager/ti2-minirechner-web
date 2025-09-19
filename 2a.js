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
function fillMicrocode() {
    // Addressed in 16x 32 Bit Blocks
    // 4 Bit for Block selection and 5 Bit for each Block
    // With instruction like for 2i for each control signal

    // Block 0/0b0000
    MPRAM[0b000000000] = "0011 00111 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000000001] = "0011 00111 0 0 1000 0000 0 1 0 1 1100 0".replace(" ", "");
    MPRAM[0b000000010] = "0000 00100 0 0 0100 1000 0 1 0 1 0010 0".replace(" ", "");
    MPRAM[0b000000011] = "0000 00101 0 0 0100 0100 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b000000100] = "0000 00110 0 0 0100 0100 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b000000101] = "0000 00110 0 0 0100 1000 0 1 0 1 0010 0".replace(" ", "");
    MPRAM[0b000000110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b000000111] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");

    MPRAM[0b000010000] = "0000 10001 0 0 0101 1111 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b000010001] = "0000 10010 1 1 0101 0100 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000010010] = "0000 10011 0 0 0101 1111 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b000010011] = "0000 10100 1 1 0101 0011 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000010100] = "0000 10101 0 0 0100 0100 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b000010101] = "0000 10110 0 0 0100 1000 0 1 0 1 0010 0".replace(" ", "");
    MPRAM[0b000010110] = "0000 10111 0 0 0011 0010 0 1 0 1 1100 0".replace(" ", "");
    MPRAM[0b000010111] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    
    // Block 1/0b0001
    MPRAM[0b000100000] = "0000 00100 0 0 1000 0110 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b000100001] = "0000 00110 0 1 0101 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b000100010] = "0000 00100 0 0 0100 0110 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b000100011] = "0000 00111 0 1 0101 0100 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b000100100] = "0000 00101 0 0 0101 1111 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b000100101] = "0011 01001 1 1 0101 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000100110] = "0000 00111 0 0 1000 0110 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b000100111] = "0011 01001 0 0 0101 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b000101000] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b000101001] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    MPRAM[0b000110000] = "0011 01001 0 0 1000 0110 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b000110001] = "0011 01001 1 1 1000 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000110010] = "0000 10101 1 1 1000 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000110011] = "0000 10100 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b000110100] = "0000 10101 1 1 0111 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b000110101] = "0011 01001 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    
    // Block 2/0b0010
    MPRAM[0b001000000] = "0001 00100 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001000001] = "0001 00100 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001000010] = "0000 00110 0 0 0101 1111 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001000011] = "0000 01010 0 1 0101 0011 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001000100] = "0011 01111 0 0 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001000101] = "0011 01111 0 1 0011 0011 0 1 1 0 0101 0".replace(" ", "");
    MPRAM[0b001000110] = "0000 00111 0 0 0011 0110 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b001000111] = "0000 01000 0 0 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001001000] = "0000 01001 1 1 0101 0011 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001001001] = "0011 01111 0 1 0110 0011 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001001010] = "0000 01011 0 0 0101 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001001011] = "0000 01100 0 1 0101 0100 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001001100] = "0000 01110 0 0 0101 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001001101] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001001110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001001111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001010000] = "0000 10110 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b001010001] = "0000 10110 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001010010] = "0000 10101 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001010011] = "0000 10100 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001010100] = "0000 10101 0 1 0111 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001010101] = "0000 10110 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001010110] = "0000 10111 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b001010111] = "0011 01111 0 0 0110 0111 0 0 0 0 0101 1".replace(" ", "");
    
    // Block 3/0b0011
    MPRAM[0b001100000] = "0011 00111 0 0 1000 0000 0 1 0 1 0010 1".replace(" ", "");
    MPRAM[0b001100001] = "0000 00100 0 0 1000 0000 0 1 0 1 0010 0".replace(" ", "");
    MPRAM[0b001100010] = "0011 00111 0 0 1000 0000 0 1 0 0 1000 1".replace(" ", "");
    MPRAM[0b001100011] = "0011 00111 0 0 1000 0000 0 1 0 0 1011 1".replace(" ", "");
    MPRAM[0b001100100] = "0011 00111 0 0 1000 0001 0 1 0 1 0100 1".replace(" ", "");
    MPRAM[0b001100101] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001100110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001100111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b001110000] = "0000 10110 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b001110001] = "0000 10110 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001110010] = "0000 10101 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001110011] = "0000 10100 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001110100] = "0000 10101 0 1 0111 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b001110101] = "0000 10110 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b001110110] = "0000 10111 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b001110111] = "0000 11000 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b001111000] = "0011 00111 0 0 0110 0111 0 0 0 0 0010 1".replace(" ", "");
    
    // Block 4/0b0100
    MPRAM[0b010000000] = "0011 00111 0 0 1000 0000 0 1 0 0 1010 1".replace(" ", "");
    MPRAM[0b010000001] = "0011 00111 0 0 1000 0001 0 1 0 1 0100 1".replace(" ", "");
    MPRAM[0b010000010] = "0011 00111 0 0 1000 0000 0 0 0 0 0001 1".replace(" ", "");
    MPRAM[0b010000011] = "0000 00011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010000100] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010000101] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010000110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b010000111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010010000] = "0011 00111 0 0 0101 0110 0 1 0 0 1100 1".replace(" ", "");
    MPRAM[0b010010001] = "0011 00111 0 0 0100 0110 0 1 0 0 1100 1".replace(" ", "");
    MPRAM[0b010010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 5/0b0101
    MPRAM[0b010100000] = "0011 01101 0 0 1000 1110 0 1 0 1 0101 1".replace(" ", "");
    MPRAM[0b010100001] = "0000 00100 0 1 1000 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b010100010] = "0000 00110 0 1 1000 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b010100011] = "0000 01000 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b010100100] = "0000 00101 0 0 0110 1110 0 1 0 1 0101 1".replace(" ", "");
    MPRAM[0b010100101] = "0011 01101 1 1 1000 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010100110] = "0000 00111 0 0 0110 1110 0 1 0 1 0101 1".replace(" ", "");
    MPRAM[0b010100111] = "0000 01011 1 1 1000 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010101000] = "0000 01001 0 1 0111 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b010101001] = "0000 01010 0 0 0110 1110 0 1 0 1 0101 1".replace(" ", "");
    MPRAM[0b010101010] = "0000 01011 1 1 0111 0110 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010101011] = "0011 01101 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b010101100] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b010101101] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b010110000] = "0000 10100 0 0 1000 0110 1 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b010110001] = "0000 10110 0 1 1000 0110 1 1 1 0 0010 0".replace(" ", "");
    MPRAM[0b010110010] = "0000 11000 0 1 1000 0110 1 1 1 0 0010 0".replace(" ", "");
    MPRAM[0b010110011] = "0000 11011 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b010110100] = "0000 10101 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b010110101] = "0011 01101 0 0 1000 0110 0 1 0 0 1100 1".replace(" ", "");
    MPRAM[0b010110110] = "0000 10111 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b010110111] = "0011 01101 1 1 1000 0110 0 0 0 0 1100 1".replace(" ", "");
    MPRAM[0b010111000] = "0000 11001 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b010111001] = "0000 11010 1 1 1000 0110 0 0 0 0 1100 1".replace(" ", "");
    MPRAM[0b010111010] = "0011 01101 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b010111011] = "0000 11100 0 1 0111 0110 1 1 1 0 0010 0".replace(" ", "");
    MPRAM[0b010111100] = "0000 11101 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b010111101] = "0000 11110 1 1 0111 0110 0 0 0 0 1100 1".replace(" ", "");
    MPRAM[0b010111110] = "0011 01101 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    
    // Block 6/0b0110
    MPRAM[0b011000000] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replace(" ", "");
    MPRAM[0b011000001] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replace(" ", "");
    MPRAM[0b011000010] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replace(" ", "");
    MPRAM[0b011000011] = "0011 00101 0 0 1000 1000 0 1 0 0 0100 1".replace(" ", "");
    MPRAM[0b011000100] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b011000101] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b011001100] = "0000 01101 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011001101] = "0000 01110 0 0 0111 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011001110] = "0000 01111 1 1 1000 0111 0 0 0 0 1100 1".replace(" ", "");
    MPRAM[0b011001111] = "0011 00101 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b011010000] = "0000 10100 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b011010001] = "0000 10111 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b011010010] = "0000 01100 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b011010011] = "0000 11010 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b011010100] = "0000 10101 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011010101] = "0000 10110 0 0 0111 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011010110] = "0011 00101 0 0 1000 0111 0 1 0 0 1100 1".replace(" ", "");
    MPRAM[0b011010111] = "0000 11000 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011011000] = "0000 11001 0 0 0111 0110 0 1 0 0 0010 0 ".replace(" ", "");
    MPRAM[0b011011001] = "0011 00101 1 1 1000 0111 0 0 0 0 1100 1".replace(" ", "");
    MPRAM[0b011011010] = "0000 11011 0 1 0111 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b011011011] = "0000 11100 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011011100] = "0000 11101 0 0 0111 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b011011101] = "0000 11110 0 1 1000 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b011011110] = "0000 11111 1 1 0110 0111 0 0 0 0 1100 1".replace(" ", "");
    MPRAM[0b011011111] = "0011 00101 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    
    // Block 7/0b0111
    MPRAM[0b011100000] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replace(" ", "");
    MPRAM[0b011100001] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replace(" ", "");
    MPRAM[0b011100010] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replace(" ", "");
    MPRAM[0b011100011] = " 0011 00101 0 0 1000 1000 0 1 0 0 0110 1".replace(" ", "");
    MPRAM[0b011100100] = " 1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b011100101] = " 0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b011110000] = " 0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b011110001] = " 0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b011110010] = " 0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b011110011] = " 0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 8/0b1000
    MPRAM[0b100000000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100000001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0 ".replace(" ", "");
    MPRAM[0b100000010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100000011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100000100] = "0000 00101 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b100000101] = "0011 00111 0 0 1000 0110 0 1 0 0 0101 1".replace(" ", "");
    MPRAM[0b100000110] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b100000111] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 9/0b1001
    MPRAM[0b100100000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100100001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100100010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100100011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100100100] = "0000 00101 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b100100101] = "0000 00110 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b100100110] = "0000 00111 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b100100111] = "0000 01000 0 0 0111 0110 0 1 0 0 0010 1".replace(" ", "");
    MPRAM[0b100101000] = "0011 01011 0 0 1000 0111 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b100101001] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100101010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b100101011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b100110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 10/0b1010
    MPRAM[0b101000000] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b101000001] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b101000010] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b101000011] = "0000 00100 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b101000100] = "0000 00101 0 0 0111 1000 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b101000101] = "0000 00110 0 0 0111 0111 0 1 0 0 0010 1".replace(" ", "");
    MPRAM[0b101000110] = "0011 01001 0 0 1000 0111 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b101000111] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101001000] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b101001001] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 11/0b1011
    MPRAM[0b101100000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b101100001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b101100010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b101100011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b101100100] = "0000 00101 0 0 0111 0000 0 1 0 1 1100 1".replace(" ", "");
    MPRAM[0b101100101] = "0010 00110 0 0 1000 0000 0 1 0 0 1000 0".replace(" ", "");
    MPRAM[0b101100110] = "0010 01001 0 0 1000 0000 0 0 0 0 0001 0".replace(" ", "");
    MPRAM[0b101100111] = "0000 00110 0 0 0111 0110 0 1 0 0 0000 1".replace(" ", "");
    MPRAM[0b101101000] = "0000 00101 0 0 0110 0110 0 1 0 0 0000 1".replace(" ", "");
    MPRAM[0b101101001] = "0011 01011 0 0 1000 0111 0 1 0 0 1110 1".replace(" ", "");
    MPRAM[0b101101010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b101101011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b101110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 12/0b1100
    MPRAM[0b110000000] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110000001] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110000010] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110000011] = "0010 00101 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110000100] = "0000 00110 0 0 0111 0000 0 1 0 1 1100 1".replace(" ", "");
    MPRAM[0b110000101] = "0000 01100 0 0 0111 1111 0 1 0 1 1100 0".replace(" ", "");
    MPRAM[0b110000110] = "0000 00111 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b110000111] = "0010 01000 0 0 1000 0110 0 1 0 0 0101 0".replace(" ", "");
    MPRAM[0b110001000] = "0000 00111 0 0 0111 0001 0 1 0 1 0100 1".replace(" ", "");
    MPRAM[0b110001001] = "0011 01011 0 0 1000 0111 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110001010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b110001011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110001100] = "0000 01001 0 0 0000 0111 0 0 0 0 1101 1".replace(" ", "");
    MPRAM[0b110010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 13/0b1101
    MPRAM[0b110100000] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110100001] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110100010] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110100011] = "0000 00100 0 0 0110 1000 0 1 0 0 1100 0".replace(" ", "");
    MPRAM[0b110100100] = "0000 00101 0 0 1000 0111 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b110100101] = "0000 00110 0 0 0111 0111 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b110100110] = "0000 00111 0 0 0110 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b110100111] = "0000 01000 0 0 0111 0110 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b110101000] = "0000 01001 0 0 1000 1000 0 1 0 0 0010 0".replace(" ", "");
    MPRAM[0b110101001] = "0011 01011 0 0 1000 0111 0 1 0 0 0010 1".replace(" ", "");
    MPRAM[0b110101010] = "1101 00000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b110101011] = "0110 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b110110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 14/0b1110
    MPRAM[0b111000000] = "0000 00000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111000001] = "0000 00001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111000010] = "0000 00010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111000011] = "0000 00011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111010000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111010001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111010010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111010011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    
    // Block 15/0b1111
    MPRAM[0b111100000] = "0000 00110 0 0 1000 0110 1 1 0 0 0001 0".replace(" ", "");
    MPRAM[0b111100001] = "0000 00110 0 1 1000 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b111100010] = "0000 00101 0 1 1000 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b111100011] = "0000 00100 0 1 1000 0111 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b111100100] = "0000 00101 0 1 0111 0110 1 1 1 0 0001 0".replace(" ", "");
    MPRAM[0b111100101] = "0000 00110 0 0 1000 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b111100110] = "0101 10000 0 1 0011 0001 0 1 0 1 0100 0".replace(" ", "");
    MPRAM[0b111110000] = "0000 10000 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111110001] = "0000 10001 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111110010] = "0000 10010 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
    MPRAM[0b111110011] = "0000 10011 0 0 0000 0000 0 0 0 0 1100 0".replace(" ", "");
}
fillMicrocode();

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