# 2a Architecture — Comprehensive Technical Specification

## Table of Contents
1. [Architectural Overview](#1-architectural-overview)
2. [Register File](#2-register-file)
3. [Memory Map & Address Space](#3-memory-map--address-space)
4. [Datapath Architecture](#4-datapath-architecture)
5. [Arithmetic Logic Unit (ALU)](#5-arithmetic-logic-unit-alu)
6. [Microprogrammed Control Unit (Steuerwerk)](#6-microprogrammed-control-unit-steuerwerk)
7. [Microinstruction Format](#7-microinstruction-format)
8. [Microcode ROM (MPRAM)](#8-microcode-rom-mpram)
9. [Instruction Fetch & Decode (OpCode Handling)](#9-instruction-fetch--decode-opcode-handling)
10. [Address Sequencer](#10-address-sequencer)
011. [Clock Cycle Execution Flow](#11-clock-cycle-execution-flow)
12. [Interrupt Subsystem](#12-interrupt-subsystem)
13. [Stack Architecture & Calling Convention](#13-stack-architecture--calling-convention)
14. [UART Peripheral (Memory-Mapped I/O)](#14-uart-peripheral-memory-mapped-io)
15. [Expansion Board Interface](#15-expansion-board-interface)
16. [General-Purpose I/O Ports](#16-general-purpose-io-ports)
17. [Instruction Set Architecture (ISA)](#17-instruction-set-architecture-isa)
18. [Assembler Directives & Source Format](#18-assembler-directives--source-format)
19. [Bus & Broadcast Channel Protocol](#19-bus--broadcast-channel-protocol)
20. [Reset & Initialization](#20-reset--initialization)

---

## 1. Architectural Overview

### 1.1 Core Properties

| Property | Value |
| --- | --- |
| **Architecture Type** | Von Neumann (unified instruction/data memory) |
| **Word Size** | 8-bit |
| **Endianness** | Big-endian for multi-byte assembler directives (high byte stored first). No hardware-level multi-byte operations. |
| **Address Space** | 8-bit (0x00–0xFF, 256 bytes total) |
| **Control Model** | Microprogrammed (horizontal microcode) |
| **Microcode ROM Size** | 512 words × 28 bits (MPRAM) |
| **Microcode Addressing** | 9-bit (512 locations), organized in 16 blocks of 32 words each |
| **Register Count** | 8 internal registers (8-bit each): R0–R2 general-purpose, R3/PC, R4/Flags, R5/SP, R6–R7 microcode-internal |
| **ALU Width** | 8-bit signed integer |
| **ALU Operations** | 16 (4-bit function select) |
| **Stack** | Pre-decrement push, post-increment pop; downward growth |
| **Interrupts** | Maskable, with dedicated IFF1/IFF2 flip-flops and RETI instruction |

### 1.2 High-Level Block Diagram

The architecture consists of four major subsystems connected by an 8-bit internal data bus:

1. **Datapath** — Register file, ALU, flag storage, and operand multiplexers
2. **Control Unit (Steuerwerk)** — Microcode ROM, address sequencer, condition evaluator, instruction register (BR)
3. **Memory Interface** — DPRAM (Data/Program RAM) with bus transceiver (busEn, busWr)
4. **Peripheral I/O** — UART (0xFA–0xFB), Expansion board (0xF0–0xF3), Input ports (0xFC–0xFD), Output ports (0xFE–0xFF)

---

## 2. Register File

The register file comprises eight 8-bit registers, organized as a dual-port read, single-port write structure. Register addressing is 3-bit (`000` through `111`).

### 2.1 Register Map

| Index | Name | Width | R/W | ABI Role | Description |
| --- | --- | --- | --- | --- | --- |
| 0 | R0 | 8-bit | R/W | Parameter 0, Return Value, Caller-saved | General-purpose register |
| 1 | R1 | 8-bit | R/W | Parameter 1, Caller-saved | General-purpose register |
| 2 | R2 | 8-bit | R/W | Parameter 2 / Scratch, Caller-saved | General-purpose register |
| 3 | PC (R3) | 8-bit | R/W | Program Counter | Points to the next instruction byte in DPRAM. Writable via memory-modifying instructions (e.g., `POP`, indirect stores). |
| 4 | Flags (R4) | 8-bit | R/W | Processor Status Word | Condition flags and interrupt mask (see §2.2) |
| 5 | SP (R5) | 8-bit | R/W | Stack Pointer | Points to the top of the stack (pre-decrement). Grows downward. |
| 6 | R6 | 8-bit | Internal | Microcode Temporary | Used exclusively by microcode — **not visible to the assembly programmer**. Holds intermediate values during complex addressing modes. |
| 7 | R7 | 8-bit | Internal | Microcode Temporary | Used exclusively by microcode — **not visible to the assembly programmer**. Holds intermediate values during complex addressing modes. |

### 2.2 Flags Register (R4) Layout

```
Bit:   7    6    5    4    3      2      1      0
     ┌────┬────┬────┬────┬──────┬──────┬──────┬──────┐
     │ 0  │ 0  │ 0  │ 0  │ IEF  │  NF  │  ZF  │  CF  │
     └────┴────┴────┴────┴──────┴──────┴──────┴──────┘
```

| Bit | Name | Description | Set By | Cleared By |
| --- | --- | --- | --- | --- |
| 0 | **CF** (Carry Flag) | Set on arithmetic carry-out (unsigned overflow) or borrow (underflow). Holds bit shifted out on shift/rotate operations. | ALU operations with `co=1`; `SETC` | ALU operations with `co=0`; `CLR` |
| 1 | **ZF** (Zero Flag) | Set if ALU result `F == 0`. | ALU result equals zero | ALU result non-zero |
| 2 | **NF** (Negative Flag) | Set if ALU result MSB (bit 7) is 1. Indicates signed negative. | ALU result bit 7 == 1 | ALU result bit 7 == 0 |
| 3 | **IEF** (Interrupt Enable Flag) | Global interrupt master switch. Only modified by `EI`, `DI`, `RETI`, `LDFR`, and `POPF`. | `EI` instruction; `RETI` restores from stack; `LDFR` | `DI` instruction; hardware clears on interrupt acknowledge; `LDFR` |
| 7–4 | — | Reserved. Always read as 0. | — | — |

### 2.3 Register Addressing Modes

Register operands within instructions encode the register index in 2-bit fields (`rr`, `dd`, `ss`):

| Encoding | Register |
| --- | --- |
| `00` | R0 |
| `01` | R1 |
| `10` | R2 |
| `11` | (not used in direct register instructions — reserved for `(Rn+)`, `((Rn+))`, and indirect modes) |

Registers R3–R7 are **not directly addressable** by assembly instructions. They are accessed implicitly via control-flow operations (PC, SP), flag manipulation (Flags), or exclusively by microcode (R6, R7).

For **indirect and complex addressing modes**, the 2-bit field encodes the pointer register as `rr = 00/01/10` for R0/R1/R2 respectively. The addressing mode itself is encoded in bits [3:2] of the source/destination byte (see §17.5).

---

## 3. Memory Map & Address Space

The 8-bit address space (0x00–0xFF) is decoded into regions with different access semantics.

### 3.1 Memory Map Table

| Address Range | Size | R/W | Region | Description |
| --- | --- | --- | --- | --- |
| 0x00–0xEF | 240 bytes | R/W | **DPRAM** (Data/Program RAM) | Unified memory for both instructions and data. Programs are loaded here and executed in-place. Byte-addressable. |
| 0xF0–0xF3 | 4 bytes | R/W | **Expansion Board Interface** | Memory-mapped I/O for expansion cards. Read/write accesses are forwarded to external `readMinibus()` / `writeMinibus()` handlers. Mapped to expansion board addresses 0–3. |
| 0xF4–0xF9 | 6 bytes | R/W | **DAC / Reserved I/O** | Digital-to-Analog Converters and reserved peripheral space. |
| 0xFA | 1 byte | See below | **UART Data Register** | **Read:** Receive Buffer Register (RxD) — returns the last fully received byte. Reading this register clears the RxReady/RxFull status bits. **Write:** Transmit Buffer Register (TxD) — queues a byte for transmission. |
| 0xFB | 1 byte | See below | **UART Status/Control Register** | **Read:** Returns `uartStatusReg` — bitfield with TxReady, TxEmpty, CTS, TxD, RxD, RTS, RxFull, RxReady flags. **Write:** Sets `uartControlReg` — configures interrupts, baudrate, and CTS behavior. |
| 0xFC | 1 byte | R-only | **General-Purpose Input Port 0** | Read-only input port. Values are externally driven. |
| 0xFD | 1 byte | R-only | **General-Purpose Input Port 1** | Read-only input port. Values are externally driven. |
| 0xFE | 1 byte | R/W | **Output Indicator Register 0** | **Write:** Sets output port 0 (e.g., LEDs, indicators). **Read:** Returns current output state (if implemented). |
| 0xFF | 1 byte | R/W | **Output Indicator Register 1** | **Write:** Sets output port 1. **Read:** Returns current output state. Also used as the shared input port 2 (read path multiplexed). |

### 3.2 Memory Access Protocol

Memory accesses are controlled by two signals from the microinstruction:
- **`busEn`** (Bus Enable): When asserted (1), the memory bus is active. When deasserted (0), the bus is tri-stated and no read/write occurs.
- **`busWr`** (Bus Write): When `busEn=1` and `busWr=1`, a write is performed to the address on the bus. When `busEn=1` and `busWr=0`, a read is performed.

The **address** for all memory operations is always the value of the A-side register selected by `mrgAA` (i.e., `getRegA()`). The **data** for writes comes from the ALU output `F`.

### 3.3 Memory Broadcast Channel

The DPRAM state is broadcast to external observers (e.g., memory visualization tools) via a `BroadcastChannel` named `"memory-channel"` using the message format:
```json
{ "msg": "update", "data": <DPRAM array>, "architecture": "a" }
```
The channel also handles a `"request-state"` message, responding with the current DPRAM contents.

---

## 4. Datapath Architecture

### 4.1 Data Flow Overview

```
Register File (8×8-bit)
    │
    ├─ Read Port A: Selected by mrgAA (4-bit) ──► RegA ──► MuxA ──► ALU Input A
    │                                                  (mAluIA select:
    │                                                  0=RegA, 1=MEMData)
    │
    ├─ Read Port B: Selected by mrgAB (4-bit) ──► RegB ──► MuxB ──► ALU Input B
    │                                                  (mAluIB select:
    │                                                  0=RegB, 1=Constant)
    │
    ├─ Write Port:  Selected by mrgWS (mux select)
    │               Data = ALU Output F (8-bit)
    │               Write Enable = mrgWE
    │
Memory Bus ◄── RegA (address) ──► DPRAM / I/O
    │
    └── MEMData ──► Internal Bus ──► MuxA / BR Load
```

### 4.2 Register Read Multiplexers

The register file read address ports are 4-bit wide but interpreted with a special mode bit:

**Port A (`mrgAA`):**
- `mrgAA[3] == 0`: Address is `mrgAA[2:0]` — selects register R0–R7 directly from microinstruction.
- `mrgAA[3] == 1`: Address is `{0, BR[1:0]}` — selects register based on **OpCode bits 1-0** (mapped to R0–R2). This allows microcode to operate on the register encoded in the instruction.

**Port B (`mrgAB`):**
- `mrgAB[3] == 0`: Address is `mrgAB[2:0]` — selects register R0–R7 directly from microinstruction.
- `mrgAB[3] == 1`: Address is `{0, BR[3:2]}` — selects register based on **OpCode bits 3-2** (mapped to R0–R2). Also provides the low 4 bits as a constant (`mrgAB[3:0]`) when `mAluIB=1` (sign-extended to 8-bit: bits [3:0] with bit 3 replicated to bits [7:4]).

### 4.3 Register Write Path

When `mrgWE == 1`:
- If `mrgWS == 0`: Write ALU result to register selected by Port A address (`mrgAA`).
- If `mrgWS == 1`: Write ALU result to register selected by Port B address (`mrgAB`).

### 4.4 Flag Update

When `mChFlg == 1`, the Flags register (R4) is updated:
- `CF` ← ALU carry-out (`co`)
- `ZF` ← ALU zero (`zo`)
- `NF` ← ALU negative (`no`)
- `IEF` bit is **preserved** (not modified by `mChFlg`).

When `mChFlg == 0`, flags retain their previous values regardless of ALU output.

---

## 5. Arithmetic Logic Unit (ALU)

### 5.1 Overview

The ALU is an 8-bit signed integer unit with a 4-bit function select input (`mAluS[3:0]`), two 8-bit data inputs (A and B), and 1-bit carry-in (Cin = CF). It produces:
- **F**: 8-bit result (always bit-masked to `0xFF`)
- **co**: Carry-out (boolean)
- **zo**: Zero detect (boolean): `F == 0`
- **no**: Negative detect (boolean): `F[7] == 1`

All arithmetic is performed using **unsigned 8-bit intermediate values** to correctly detect carry/borrow conditions. Inputs are interpreted as 8-bit bit patterns; signed/unsigned semantics are determined by instruction context.

### 5.2 ALU Function Table

| `mAluS[3:0]` | Mnemonic | Operation (Pseudocode) | Carry-out (co) | Notes |
| --- | --- | --- | --- | --- |
| `0000` | **ADDH** | `F = A + B` | `CF \|\| (A+B > 0xFF)` | Add and hold carry: OR of incoming CF and new carry |
| `0001` | **A** | `F = A` | `0` | Pass-through A; B and Cin ignored |
| `0010` | **NOR** | `F = ~(A \| B)` | `0` | Bitwise NOR; when B = A: complement (COM) |
| `0011` | **ZERO** | `F = 0` | `0` | Constant zero output; ZF always set |
| `0100` | **ADD** | `F = A + B` | `A+B > 0xFF` | Standard addition; when B = A: logical shift left (LSL) |
| `0101` | **ADDS** | `F = A + B + 1` | `!(A+B+1 > 0xFF)` | Add for subtraction (two's complement); inverted carry |
| `0110` | **ADC** | `F = A + B + Cin` | `A+B+Cin > 0xFF` | Add with carry; when B = A: rotate left through carry (RLC) |
| `0111` | **ADCS** | `F = A + B + !Cin` | `!(A+B+!Cin > 0xFF)` | ADC for subtraction; inverted carry |
| `1000` | **LSR** | `F[n] = A[n+1]`; `F[7] = 0` | `A[0]` | Logical shift right; 0 shifted into MSB |
| `1001` | **RR** | `F[n] = A[n+1]`; `F[7] = A[0]` | `A[0]` | Rotate right (no carry involvement) |
| `1010` | **RRC** | `F[n] = A[n+1]`; `F[7] = Cin` | `A[0]` | Rotate right through carry |
| `1011` | **ASR** | `F[n] = A[n+1]`; `F[7] = A[7]` | `A[0]` | Arithmetic shift right; sign bit preserved in MSB |
| `1100` | **B** | `F = B` | `0` | Pass-through B (clear carry) |
| `1101` | **SETC** | `F = B` | `1` | Pass-through B (set carry) |
| `1110` | **BH** | `F = B` | `Cin` | B and hold carry (carry unchanged) |
| `1111` | **INVC** | `F = B` | `!Cin` | B and invert carry |

### 5.3 Flag Generation

After every ALU evaluation:
- **Zero Flag (ZF)**: `zo = (F == 0)`
- **Negative Flag (NF)**: `no = (F[7] == 1)`
- **Carry Flag (CF)**: Set to `co` only when `mChFlg == 1`

### 5.4 ALU Input Multiplexers

- **Input A** (`mAluIA`): `0` → Register A output; `1` → Memory bus data (MEMDI)
- **Input B** (`mAluIB`): `0` → Register B output; `1` → Constant from `mrgAB[3:0]` sign-extended to 8 bits

This dual-multiplexer arrangement enables the ALU to operate on register-register, register-memory, register-immediate, and memory-immediate combinations at the microcode level.

---

## 6. Microprogrammed Control Unit (Steuerwerk)

### 6.1 Overview

The 2a architecture uses a **horizontal microprogrammed control unit** — every control signal in the datapath is driven directly by a bit in the current microinstruction. This is in contrast to vertical microcode where fields are encoded and decoded.

The control unit consists of:
- **MPRAM**: 512 × 28-bit microcode ROM (see §8)
- **µPC (Microprogram Counter)**: 9-bit address register (`currentAddr`)
- **Address Sequencer**: Logic that computes the next microinstruction address based on current microinstruction fields, condition codes, and opcode bits
- **BR (Befehlsregister / Instruction Register)**: 8-bit latch that captures the current instruction opcode from the memory bus at the appropriate microcode step
- **IFF1/IFF2**: Interrupt flip-flops for interrupt synchronization

### 6.2 BR — Instruction Register

The BR is an 8-bit register loaded from the memory data bus (`MEMDI`) under specific microcode control conditions. It splits conceptually into two fields:

```
BR[7:4] — NextAddress[8:5] (upper bits of the next microcode address)
BR[3:0] — OpCode[3:0] (instruction-specific opcode bits)
```

**Bits used for register selection within microcode:**
- `BR[1:0]` — Select register for Port A when `mrgAA[3] == 1` (destination register or single-operand register)
- `BR[3:2]` — Select register for Port B when `mrgAB[3] == 1` (source register for two-operand instructions)
- `BR[3]` (OP10) and `BR[2]` (OP01/OP10) — Used in address sequencing for condition multiplexing

**Bits used for branch condition selection:**
- `BR[1:0]` — Select which flag to evaluate: `00` → always (JR), `01` → CF, `10` → ZF, `11` → NF
- `BR[2]` — Invert sense: `0` → branch if set (JCS/JZS/JNS), `1` → branch if clear (JCC/JZC/JNC)
- `BR[3]` — Used as part of AM2 computation

**Loading condition:**
BR is loaded from the memory bus when **both** `mAC[0] == 1` AND `mAC[2] == 1` (i.e., `mAC[0] & (mAC[2] >> 2)` are true). This typically occurs at the end of the instruction fetch sequence.

**Resetting condition:**
BR is reset to `0x00` when **both** `mAC[1] == 1` AND `mAC[2] == 1`. This clears the instruction register for the next fetch cycle.

### 6.3 CTRL — Current Microinstruction Register

The CTRL object holds the decoded fields of the current 28-bit microinstruction. Its structure is defined in §7.

---

## 7. Microinstruction Format

Each microinstruction is 28 bits wide, organized as follows:

### 7.1 Bit Layout

```
Bit:  27       26    25    24    23    22    21    20    19    18    17    16    15    14    13    12    11    10     9     8     7     6     5     4     3     2     1     0
     ┌───────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
     │mChFlg │mAluS3│mAluS2│mAluS1│mAluS0│mAluIB│mAluIA│mrgWE │mrgWS │mrgAB3│mrgAB2│mrgAB1│mrgAB0│mrgAA3│mrgAA2│mrgAA1│mrgAA0│busEn │busWr │ nA4  │ nA3  │ nA2  │ nA1  │ nA0  │ mAC3 │ mAC2 │ mAC1 │ mAC0 │
     └───────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

### 7.2 Field Descriptions (MSB to LSB, index 27→0)

| Bit(s) | Field | Width | Description |
| --- | --- | --- | --- |
| 27 | **mChFlg** | 1 | **Change Flags.** When 1, update CF, ZF, NF from ALU outputs. When 0, flags are preserved. |
| 26–23 | **mAluS[3:0]** | 4 | **ALU Function Select.** Selects one of 16 ALU operations (see §5.2). |
| 22 | **mAluIB** | 1 | **ALU Input B Select.** `0` = Register B output; `1` = Constant from `mrgAB[3:0]` (sign-extended). |
| 21 | **mAluIA** | 1 | **ALU Input A Select.** `0` = Register A output; `1` = Memory bus data (MEMDI). |
| 20 | **mrgWE** | 1 | **Register Write Enable.** When 1, write ALU result `F` to the register file at the selected write address. |
| 19 | **mrgWS** | 1 | **Register Write Select.** `0` = Write to Port A address (`mrgAA`); `1` = Write to Port B address (`mrgAB`). |
| 18–15 | **mrgAB[3:0]** | 4 | **Register Address B / Immediate Constant.** Bits [2:0]: Register B address (when `mrgAB[3]==0`) or OpCode-based selection (when `mrgAB[3]==1`). Bit 3: Mode selector. When `mAluIB==1`, bits [3:0] provide an immediate constant (sign-extended to 8 bits). |
| 14–11 | **mrgAA[3:0]** | 4 | **Register Address A.** Bits [2:0]: Register A address (when `mrgAA[3]==0`) or OpCode-based selection (when `mrgAA[3]==1`). Bit 3: Mode selector. Also serves as the memory address for bus operations. |
| 10 | **busEn** | 1 | **Bus Enable.** When 1, the memory bus is active. Enables read/write to DPRAM, peripherals, and I/O. |
| 9 | **busWr** | 1 | **Bus Write.** When 1 (and `busEn==1`), write ALU result `F` to the address specified by Register A. When 0, read from memory. |
| 8–4 | **nextAddr[4:0]** | 5 | **Next Address (low bits).** Lower 5 bits of the next microcode address. Combined with BR bits and condition logic to form the complete 9-bit µPC. |
| 3–0 | **mAC[3:0]** | 4 | **Microcode Address Control.** Controls the address sequencer, BR load/reset, and condition multiplexer selection. |

### 7.3 Microinstruction String Representation

In the JavaScript implementation, each microinstruction is stored as a 28-character string without spaces:

```
"0011 00111 0 0 0000 0000 0 0 0 0 1100 0"  →  "00110011100000000000000011000"
  │    │    │ │ │    │    │ │ │ │ │    │
  │    │    │ │ │    │    │ │ │ │ │    └─ mChFlg
  │    │    │ │ │    │    │ │ │ │ └────── mAluS[3:0]
  │    │    │ │ │    │    │ │ │ └──────── mAluIB
  │    │    │ │ │    │    │ │ └────────── mAluIA
  │    │    │ │ │    │    │ └──────────── mrgWE
  │    │    │ │ │    │    └────────────── mrgWS
  │    │    │ │ │    └─────────────────── mrgAB[3:0]
  │    │    │ │ └──────────────────────── mrgAA[3:0]
  │    │    │ └────────────────────────── busEn
  │    │    └──────────────────────────── busWr
  │    └───────────────────────────────── nextAddr[4:0]
  └────────────────────────────────────── mAC[3:0]
```

---

## 8. Microcode ROM (MPRAM)

### 8.1 Organization

The MPRAM contains 512 words (addresses `0x000` to `0x1FF`, 9-bit addressing). It is conceptually organized into **16 blocks** of 32 words each, selected by the upper 4 bits (`nextAddr[8:5]`, derived from `BR[7:4]`).

### 8.2 Block Assignment Map

| Block | Address Range | Instruction Class / Function |
| --- | --- | --- |
| **0** (0x0) | 0x000–0x01F | **Instruction Fetch (RESET sequence).** Loads BR, decodes opcode, dispatches to instruction-specific blocks. |
| **1** (0x1) | 0x020–0x03F | **CLR, INC, DEC, NEG, COM, LSR, ASR, TST** — Single-operand register instructions (opcodes `000001rr` through `010010rr`). |
| **2** (0x2) | 0x040–0x05F | **MOV, LD, ST** — Complex addressing mode load/store operations. Decodes destination byte and source byte. |
| **3** (0x3) | 0x060–0x07F | **ADD, ADC, SUB** — Two-operand arithmetic instructions (opcodes `0110ssdd`, `0111ssdd`, `1000ssdd`). |
| **4** (0x4) | 0x080–0x09F | **AND, OR, XOR** — Two-operand logic instructions (opcodes `1001ssdd`, `1010ssdd`, `1101ssdd`). Includes `EI`, `DI`, `RET`, `RETI`, `PUSHF`, `POPF`, `STOP`, `NOP`. |
| **5** (0x5) | 0x0A0–0x0BF | **CMP** — Compare instruction class (opcode class `0x20`). |
| **6** (0x6) | 0x0C0–0x0DF | **BITT** (Bit Test) — Bit-test class (opcode class `0x30`). |
| **7** (0x7) | 0x0E0–0x0FF | **BITS** (Bit Set) — Bit-set class (opcode class `0x50`). |
| **8** (0x8) | 0x100–0x11F | **BITC** (Bit Clear, Part 1) — Bit-clear class (opcode class `0x60`). |
| **9** (0x9) | 0x120–0x13F | **BITC** (Bit Clear, Part 2) — Continuation of bit-clear operations. |
| **10** (0xA) | 0x140–0x15F | **Conditional Branches (JCS, JCC, JZS, JZC, JNS, JNC, JR)** — Relative branch evaluation and PC update. |
| **11** (0xB) | 0x160–0x17F | **CALL** — Subroutine call: push return address and jump to target. |
| **12** (0xC) | 0x180–0x19F | **RET** — Subroutine return: pop return address into PC. |
| **13** (0xD) | 0x1A0–0x1BF | **RETI** — Return from interrupt: pop Flags and PC. |
| **14** (0xE) | 0x1C0–0x1DF | **Interrupt Handler / HALT state.** Handles interrupt acknowledge sequence and STOP condition. |
| **15** (0xF) | 0x1E0–0x1FF | **MUL, DIV** — Multiply and divide operations (opcodes `1011ssdd`, `1100ssdd`). |

### 8.3 Microcode Execution Flow

1. **Reset:** µPC forced to address `0x000` (Block 0). The reset sequence initializes the datapath and begins instruction fetch.
2. **Instruction Fetch:** Microcode in Block 0 loads the next opcode byte from DPRAM (addressed by PC) into BR.
3. **Dispatching:** The upper 4 bits of the 9-bit next address come from `BR[7:4]`, effectively using the opcode's upper nibble to select the microcode block. The lower 5 bits come from `nextAddr[4:0]` and condition logic.
4. **Execution:** The selected block sequences through its microinstructions, performing register operations, ALU computations, memory accesses, and flag updates.
5. **Next Instruction:** The block concludes by returning control to the fetch sequence (Block 0).

---

## 9. Instruction Fetch & Decode (OpCode Handling)

### 9.1 Fetch Sequence (Block 0)

The reset and fetch sequence (addresses 0x000–0x01F) performs:

1. **Microinstruction 0x000:** Set up initial conditions. `mrgAA` targets PC (R3). `busEn=1`, `busWr=0` — read from DPRAM at PC address. `mAC=0b1100` — enables BR load condition (`mAC[0] & mAC[2]`).
2. **Microinstruction 0x001:** Continue fetch. ALU function `ADDH` (0x0) computes `PC + 0`. Memory data is available on the bus. BR is loaded with the opcode byte.
3. **Subsequent cycles:** The microcode sequences through additional steps depending on the opcode class. For simple single-byte instructions, execution completes within Block 0. For multi-byte instructions (addressing modes, branches, calls), the sequencer dispatches to the appropriate block via the next-address mechanism.

### 9.2 OpCode Decoding

The BR register splits the fetched byte into:

- **`BR[7:4]`** → Next microcode address bits `[8:5]`. These 4 bits select which of the 16 microcode blocks to execute.
- **`BR[3:0]`** → Specific opcode within the class. These bits are used:
  - As register selectors (`BR[1:0]` for destination register, `BR[3:2]` for source register)
  - As condition selectors for branches (`BR[1:0]` = flag select, `BR[2]` = invert/sense)
  - As sub-function selectors within a microcode block (via condition multiplexing on `nextAddr[4:0]`)

### 9.3 OpCode → Block Mapping

The upper nibble of the instruction's first byte determines the microcode block:

| `BR[7:4]` | Block | Instruction Class |
| --- | --- | --- |
| `0000` | 0 | STOP (0x01), NOP (0x02), EI (0x08), DI (0x0C), PUSH (0x1x), POP (0x1x), RET (0x17), PUSHF (0x18), POPF (0x1C), CLR (0x04–0x07) |
| `0001` | 1 | CLR (partial), INC (0x44–0x47), DEC (0x50–0x53), NEG (0x34–0x37), COM (0x30–0x33), LSR (0x38–0x3B), ASR (0x3C–0x3F), TST (0x48–0x4B) |
| `0010` | 2 | MOV/LD/ST (class 0x10), CMP (class 0x20), BITT (class 0x30), Conditional Branches (0x20–0x27) |
| `0011` | — | (see below) |
| ... | ... | ... |

*Note: The exact mapping depends on how `BR[7:4]` feeds into `nextAddr[8:5]` via the address sequencer.*

---

## 10. Address Sequencer

### 10.1 Next Address Generation

The 9-bit next microcode address is computed as:

```
NextAddr[8:0] = {
    NextAddr[8]:    BR[7]  (via BR[7:4] << 1)
    NextAddr[7]:    BR[6]
    NextAddr[6]:    BR[5]
    NextAddr[5]:    BR[4]
    NextAddr[4:2]:  nextAddr[4:2]  (from microinstruction)
    NextAddr[1]:    (mAC[3]==0) ? nextAddr[1] : BR[3]
    NextAddr[0]:    (mAC[3]==0) ? AM1 : BR[2]
}
```

- When `mAC[3] == 0`: The sequencer uses **sequential** mode. `nextAddr[1:0]` comes from the microinstruction, with `nextAddr[0]` potentially modified by AM1.
- When `mAC[3] == 1`: The sequencer uses **dispatch** mode. `nextAddr[1:0]` are controlled by BR bits, enabling multi-way branches within a microcode block based on opcode bits.

### 10.2 AM1 — Address Multiplexer 1 (Condition on `nextAddr[0]`)

`AM1` is a 1-bit signal computed from condition codes, used to modify the least significant bit of the next address. It implements conditional sequencing.

```
AM1 = f( mAC[1:0], nextAddr[0], CF, ZF, NF, IEF, IFF1, INTL, AM2 )

Mapping (mAC[1:0] << 1 | nextAddr[0]):
  0b000: 0                              (always 0 — unconditional)
  0b001: 1                              (always 1 — unconditional)
  0b010: BR[2] XOR AM2                  (conditional on BR[2] and AM2)
  0b011: CF                             (conditional on Carry Flag)
  0b100: ALU.co                         (conditional on ALU carry-out)
  0b101: ALU.zo                         (conditional on ALU zero)
  0b110: ALU.no                         (conditional on ALU negative)
  0b111: IEF & (INTL | IFF1)            (interrupt pending and enabled)
```

### 10.3 AM2 — Second-Level Condition Mux

`AM2` selects one of the processor flags based on `BR[1:0]`:

```
AM2 = f(BR[1:0]):
  00: 1           (always true — unconditional)
  01: CF          (Carry Flag)
  10: ZF          (Zero Flag)
  11: NF          (Negative Flag)
```

This is used in conjunction with `AM1` mode `0b010` (condition `BR[2] XOR AM2`) to implement conditional branches:
- `BR[2] == 0`: Branch if condition **set** (JCS, JZS, JNS)
- `BR[2] == 1`: Branch if condition **clear** (JCC, JZC, JNC)

### 10.4 Complete Addressing Modes

The `mAC[3:0]` field encodes the sequencer operating mode:

| `mAC[3:0]` | Mode Description |
| --- | --- |
| `0000` | Sequential execution, AM1=0 (unconditional next) |
| `0001` | Sequential execution, AM1=1 (unconditional next+1) |
| `0010` | Sequential with condition (AM1 from lookup, `nextAddr[0]` used) |
| `0011` | Sequential with CF condition |
| `0100` | Sequential with ALU.co condition |
| `0101` | Sequential with ALU.zo condition |
| `0110` | Sequential with ALU.no condition |
| `0111` | Sequential with interrupt condition |
| `1000`–`1011` | Dispatch mode (BR bits control `nextAddr[1:0]`) + BR load enable |
| `1100` | Dispatch mode + BR load + BR reset conditions |
| `1101` | Special: memory address output mode |
| `1110` | Special: PC increment mode |
| `1111` | HALT / end-of-instruction |

*Note: The exact encoding is inferred from the JavaScript implementation. `mAC[0]` and `mAC[2]` together control BR loading (`mAC[0] & (mAC[2]>>2)`). `mAC[1]` and `mAC[2]` together control BR reset. `mAC[3]` controls dispatch vs sequential mode.* 

---

## 11. Clock Cycle Execution Flow

Each clock cycle executes the following sequence of operations in order:

### 11.1 `clk()` Function — Per-Cycle Operations

```
1. setReg()       — Write ALU result to register file (if mrgWE=1)
2. setMemBus()    — Perform memory read/write (if busEn=1)
3. setCTRL()      — Load next microinstruction from MPRAM into CTRL
4. setBR()        — Load BR from memory bus (if mAC conditions met)
5. resetBR()      — Reset BR to 0x00 (if mAC conditions met)
6. setIFF2()      — Update IFF2 based on IFF1 and timing signals
7. resetIFF1()    — Clear IFF1 if IFF2 was set
8. [OpCode detection] — If mAC[3]==1, notify that next instruction opcode is available
```

### 11.2 Detailed Sub-Step Description

#### setReg()
- Computes `getALU()` with current ALU inputs and function select.
- If `mrgWE == 1`: writes `F & 0xFF` to the target register (selected by `mrgWS`: 0→Port A address, 1→Port B address).
- If `mChFlg == 1`: writes CF, ZF, NF to R4 (IEF is preserved).

#### setMemBus()
- If `busEn == 1`:
  - **Read** (`busWr == 0`): Data from the addressed memory/peripheral is available on the bus for the *next* cycle's ALU input.
  - **Write** (`busWr == 1`): The ALU output value is written to:
    - DPRAM[addr] if `0x00 ≤ addr ≤ 0xEF`
    - Expansion board if `0xF0 ≤ addr ≤ 0xF3` (via `writeMinibus(addr-0xF0, data)`)
    - UART TX buffer if `addr == 0xFA`
    - UART control register if `addr == 0xFB`
    - Output ports if `0xFE ≤ addr ≤ 0xFF`
- After a write, the DPRAM state is broadcast via `BroadcastChannel("memory-channel")`.

#### setCTRL()
- Computes `nextAddr = getNextAddr()` (the 9-bit µPC for the next cycle).
- Fetches the 28-bit microinstruction string from `MPRAM[nextAddr]`.
- Parses each field into the `CTRL` object.

#### setBR()
- If `mAC[0] == 1` AND `(mAC[2] >> 2) == 1` (i.e., `mAC[0] & mAC[2]`): loads BR from the memory bus data (`getMemBusData()`).

#### resetBR()
- If `mAC[1] == 1` AND `(mAC[2] >> 2) == 1`: resets BR to `0x00`.

#### setIFF2()
- `IFF2 = IFF1 && mAC[1] && mAC[0] && nextAddr[0]`
- This captures the interrupt synchronization state.

#### resetIFF1()
- If `IFF2 == true`: clears `IFF1 = false`.

### 11.3 Cycle Timing Diagram (Conceptual)

```
         ┌──────┐     ┌──────┐     ┌──────┐
CLK  ────┘      └─────┘      └─────┘      └───
         ───────┐     ┌─────────────┐     ┌──
setReg    write │─────│   (idle)    │─────│
         ───────┘     └─────────────┘     └──
                ┌─────┐           ┌─────┐
setMemBus       │ R/W │───────────│ R/W │
                └─────┘           └─────┘
                      ┌───────────┐
setCTRL               │ load µPC  │
                      └───────────┘
                            ┌─────┐
setBR/setIFF2               │ upd │
                            └─────┘
```

---

## 12. Interrupt Subsystem

### 12.1 Interrupt Flip-Flops

The interrupt system uses two flip-flops for synchronization:

| Signal | Type | Description |
| --- | --- | --- |
| **IFF1** | Internal flip-flop | Set by external interrupt request. Captures the interrupt condition. |
| **IFF2** | Internal flip-flop | Temporary storage. Set at specific microcode timing: `IFF2 = IFF1 && mAC[1] && mAC[0] && nextAddr[0]`. Used to gate IFF1 clearing. |
| **INTL** | External signal | Interrupt request line (active high). Current implementation returns `false` (TODO). |
| **INTE** | External signal | Interrupt enable from external logic. Current implementation returns `false` (TODO). |

### 12.2 Interrupt Acknowledge Sequence

When an interrupt is pending (`IEF == 1` AND `(INTL | IFF1) == 1`) and the microcode evaluates the interrupt condition (`AM1` mode `0b111`), the hardware:

1. **Enters the interrupt microcode block** (Block 14, addresses 0x1C0–0x1DF).
2. **Saves processor state to the stack:**
   - Decrements SP (R5) and pushes the current PC (R3) onto the stack.
   - Decrements SP and pushes the Flags register (R4) onto the stack.
3. **Clears IEF** to disable further interrupts during ISR execution.
4. **Vectors to the ISR address** (determined by the interrupt handling microcode — current implementation uses a fixed or externally provided vector).
5. **ISR executes** as normal code.
6. **`RETI` instruction** (opcode `0x2C`, Block 13):
   - Pops Flags register from stack (restoring IEF to its pre-interrupt state).
   - Pops PC from stack (returning to the interrupted instruction).
   - Execution resumes at the return address.

### 12.3 Interrupt Timing

The interrupt condition is only sampled when the microcode's AM1 logic evaluates `0b111`. This typically occurs at the end of an instruction's execution (or at specific poll points within long instructions). The use of IFF1/IFF2 provides edge-triggered behavior — an interrupt request is latched in IFF1 and acknowledged at the next sampling point.

---

## 13. Stack Architecture & Calling Convention

### 13.1 Stack Pointer (SP = R5)

- **Direction:** Downward (stack grows toward lower addresses)
- **Operation:**
  - **PUSH / CALL:** `SP = SP - 1; Memory[SP] = value` (pre-decrement)
  - **POP / RET:** `value = Memory[SP]; SP = SP + 1` (post-increment)
- **Initial Value:** Not architecturally defined. Must be initialized by software before any stack operations (`PUSH`, `POP`, `CALL`, `RET`, `RETI`, `PUSHF`, `POPF`).
- **Range:** 0x00 to 0xEF (within DPRAM). Stack wrapping or overflow is not detected in hardware.

### 13.2 Calling Convention (ABI)

| Aspect | Convention |
| --- | --- |
| **Argument Passing** | First argument in R0, second in R1, third in R2. Additional arguments (if any) passed on the stack (caller cleans up). |
| **Return Value** | Returned in R0. |
| **Caller-Saved Registers** | R0, R1, R2 — callee may modify freely. Caller must save before call if values needed after. |
| **Callee-Saved Registers** | None defined at hardware level. All user registers (R0–R2) are considered caller-saved. |
| **Stack Alignment** | 1 byte (natural byte alignment). |
| **Frame Pointer** | Not defined in hardware. Software conventions may use a register as frame pointer. |

### 13.3 CALL Instruction Sequence (Microcode Block 11)

1. Compute target address (from operand byte following CALL opcode).
2. Decrement SP.
3. Write incremented PC (return address) to `DPRAM[SP]`.
4. Load target address into PC.
5. Fetch next instruction from the new PC location.

### 13.4 RET Instruction Sequence (Microcode Block 12)

1. Read `DPRAM[SP]` into temporary register.
2. Increment SP.
3. Load the read value into PC.
4. Fetch next instruction from the restored PC location.

### 13.5 RETI Instruction Sequence (Microcode Block 13)

1. Read `DPRAM[SP]` into temporary (Flags value).
2. Increment SP.
3. Write popped value to Flags register (R4) — restores IEF, CF, ZF, NF.
4. Read `DPRAM[SP]` into temporary (return address).
5. Increment SP.
6. Write popped value to PC (R3).
7. Fetch next instruction from the restored PC location.

---

## 14. UART Peripheral (Memory-Mapped I/O)

The UART is mapped to two addresses in the I/O space and provides asynchronous serial communication.

### 14.1 Register Map

| Address | Direction | Register | Width | Description |
| --- | --- | --- | --- | --- |
| 0xFA | Read | **RxD (Receive Data Register)** | 8-bit | Contains the last fully received byte. Reading this register clears the RxReady and RxFull status bits and allows reception of the next byte. |
| 0xFA | Write | **TxD (Transmit Data Register)** | 8-bit | Writing to this register queues a byte for serial transmission. If a transmission is already in progress, the byte is buffered. |
| 0xFB | Read | **UART Status Register** | 8-bit | Returns current UART status flags (see §14.3). |
| 0xFB | Write | **UART Control Register** | 8-bit | Configures UART behavior: interrupt enables, baudrate, and CTS handling (see §14.4). |

### 14.2 Internal UART State

| State Variable | Type | Description |
| --- | --- | --- |
| `uartRecvReg` | 8-bit | Holding register for the last completely received byte. |
| `uartRecvShiftReg` | 8-bit or null | Shift register for receiving data. Non-null when a byte is being received. |
| `uartRecvRead` | Boolean | True when the CPU has read the last received byte (ready for new data). False when unread data is pending. |
| `uartSendBuffer` | 8-bit or null | Buffer holding the next byte to transmit. Cleared when transmission begins. |
| `uartSendShiftReg` | 8-bit or null | Shift register for transmitting data. Non-null when a byte is being transmitted. |
| `uartStatusReg` | 8-bit | Computed status register (see §14.3). |
| `uartControlReg` | 8-bit | Configuration register (see §14.4). |

### 14.3 UART Status Register (Read 0xFB)

| Bit | Name | Description |
| --- | --- | --- |
| 7 | **TxReady** | `1` when the transmitter is ready to accept a new byte for transmission (`uartSendBuffer == null`). |
| 6 | **TxEmpty** | `1` when both the transmit buffer and shift register are empty (no data waiting or in transit). |
| 5 | **!CTS** | Clear-to-Send negation. `1` when CTS is not asserted (transmitter is not clear to send). |
| 4 | **TxD** | Current output level on the Tx line (0 or 1). |
| 3 | **RxD** | Current input level on the Rx line (0 or 1). |
| 2 | **!RTS** | Request-to-Send negation. `1` when UART cannot accept new data (`uartRecvShiftReg != null`). |
| 1 | **RxFull** | `1` when a complete byte has been received and is waiting to be read (`!uartRecvRead && uartRecvShiftReg != null`). |
| 0 | **RxReady** | `1` when received data is ready to be read by the CPU (`!uartRecvRead`). |

### 14.4 UART Control Register (Write 0xFB)

| Bit(s) | Name | Description |
| --- | --- | --- |
| 7 | **IRRxR** | Interrupt on RxReady. When `1`, generates an interrupt when RxReady becomes active. |
| 6 | **IRRxF** | Interrupt on RxFull. When `1`, generates an interrupt when RxFull becomes active. |
| 5 | **TxEmpty** | (Write effect unknown/implementation-specific) |
| 4 | **TxReady** | (Write effect unknown/implementation-specific) |
| 3 | **!CTS_IGN** | CTS Ignore. `0` = honor CTS signal; `1` = ignore CTS and transmit regardless. |
| 2 | **(reserved)** | Always write 0. |
| 1–0 | **Baudrate[1:0]** | Selects baudrate: `00` = 115200, `01` = 38400, `10` = 19200, `11` = 9600. |

### 14.5 UART Timing

The UART transmission update function runs on a timer with period `1,000,000 / baudrate` microseconds (1 bit time). On each tick:

1. **Transmit side:** If `uartSendShiftReg == null` and `uartSendBuffer != null`, move the buffer byte to the shift register and clear the buffer.
2. **Receive side:** If `uartRecvRead == true` and `uartRecvShiftReg != null`, move the shift register content to `uartRecvReg`, clear the shift register, and set `uartRecvRead = false` (data available).
3. The timer is re-armed with the appropriate baudrate period.

### 14.6 UART Interrupts

When enabled via control register bits 7–6, the UART can assert the interrupt line (INTL) when:
- A byte has been received and is ready to read (RxReady)
- The receive buffer becomes full (RxFull)

The interrupt handling follows the standard interrupt sequence described in §12.

---

## 15. Expansion Board Interface

Addresses 0xF0–0xF3 are reserved for external expansion boards. Memory accesses to these addresses are forwarded to external JavaScript functions:

### 15.1 Read Access
```javascript
if (addr >= 0xF0 && addr <= 0xF3) {
    return readMinibus(addr - 0xF0);  // Expansion board address 0-3
}
```
If `readMinibus` is not available, a warning is logged and `0` is returned.

### 15.2 Write Access
```javascript
if (addr >= 0xF0 && addr <= 0xF3) {
    writeMinibus(addr - 0xF0, data);  // Expansion board address 0-3
}
```
If `writeMinibus` is not available, a warning is logged and the write is discarded.

---

## 16. General-Purpose I/O Ports

### 16.1 Input Ports (Read-Only)

| Address | Name | Description |
| --- | --- | --- |
| 0xFC | Input Port 0 | 8-bit general-purpose digital input. Externally driven. |
| 0xFD | Input Port 1 | 8-bit general-purpose digital input. Externally driven. |
| 0xFE | Input Port 2 (read path) | 8-bit general-purpose digital input (shared with Output Port 0 address). |
| 0xFF | Input Port 3 (read path) | 8-bit general-purpose digital input (shared with Output Port 1 address). |

Inputs are stored in the `inputs` object: `{ ff: value, fe: value, fd: value, fc: value }`.

### 16.2 Output Ports (Read/Write)

| Address | Name | Description |
| --- | --- | --- |
| 0xFE | Output Register 0 | 8-bit output port. Writing sets the output value. Reading returns the current output state. |
| 0xFF | Output Register 1 | 8-bit output port. Writing sets the output value. Reading returns the current output state. |

Outputs are stored in the `outputs` object: `{ ff: value, fe: value }`.

---

## 17. Instruction Set Architecture (ISA)

### 17.1 Instruction Encoding Overview

Instructions are encoded in one to four bytes, depending on the addressing modes used:

- **1-byte instructions:** Single-operand register operations, control instructions (STOP, NOP, EI, DI, RET, RETI, PUSHF, POPF).
- **2-byte instructions:** Branch instructions (opcode + signed offset), PUSH/POP register, CLR/INC/DEC/NEG/COM/LSR/ASR/RRC/TST register.
- **2–4 byte instructions:** Instructions using complex addressing modes (MOV, LD, ST, CMP, BITT, BITS, BITC, LDSP, LDFR, JMP).

### 17.2 Zero-Operand & Simple Control Instructions

| Mnemonic | Opcode (Hex) | Opcode (Binary) | Operation | Flags Affected | Bytes |
| --- | --- | --- | --- | --- | --- |
| `STOP` | `0x01` | `00000001` | Halt execution (enters Block 14 idle state) | None | 1 |
| `NOP` | `0x02` | `00000010` | No operation (1 cycle) | None | 1 |
| `EI` | `0x08` | `00001000` | Enable Interrupts: `IEF = 1` | IEF | 1 |
| `DI` | `0x0C` | `00001100` | Disable Interrupts: `IEF = 0` | IEF | 1 |
| `RET` | `0x17` | `00010111` | Return from Subroutine: `PC = Pop()` | None | 1 |
| `RETI` | `0x2C` | `00101100` | Return from Interrupt: `Flags = Pop(); PC = Pop()` | C, N, Z, IEF | 1 |
| `PUSHF` | `0x18` | `00011000` | Push Flags register to stack: `Push(Flags)` | None | 1 |
| `POPF` | `0x1C` | `00011100` | Pop Flags register from stack: `Flags = Pop()` | C, N, Z, IEF | 1 |

### 17.3 Register-Only Instructions (Single-Operand)

**Encoding format:** Upper 6 bits are opcode; lower 2 bits (`rr`) encode destination register (R0=00, R1=01, R2=10).

| Mnemonic | Opcode (Binary) | Syntax | Operation | Flags Affected | ALU Function Used |
| --- | --- | --- | --- | --- | --- |
| `CLR` | `000001rr` | `CLR Rn` | `Rn = 0` | C=0, N=0, Z=1 | ZERO (0x3) |
| `INC` | `010001rr` | `INC Rn` | `Rn = Rn + 1` | C, N, Z | ADDS (0x5) with B=0 |
| `DEC` | `010100rr` | `DEC Rn` | `Rn = Rn - 1` | C, N, Z | ADD (0x4) with B=0xFF? |
| `NEG` | `001101rr` | `NEG Rn` | `Rn = -Rn` (two's complement) | C, N, Z | Via ALU subtraction |
| `COM` | `001100rr` | `COM Rn` | `Rn = ~Rn` (bitwise NOT) | C=0, N, Z | NOR (0x2) with B=Rn |
| `LSR` | `001110rr` | `LSR Rn` | `C = Rn[0]; Rn = Rn >>> 1` | C, N, Z | LSR (0x8) |
| `ASR` | `001111rr` | `ASR Rn` | `C = Rn[0]; Rn = Rn >> 1` (sign-extended) | C, N, Z | ASR (0xB) |
| `LSL` | `0110ssdd` (ss=dd) | `LSL Rn` | `Rn = Rn << 1` (encoded as `ADD Rn, Rn`) | C, N, Z | ADD (0x4) |
| `RRC` | `010000rr` | `RRC Rn` | `temp = Rn[0]; Rn = (CF<<7) \| (Rn>>>1); CF = temp` | C, N, Z | RRC (0xA) |
| `RLC` | `0111ssdd` (ss=dd) | `RLC Rn` | Rotate left through carry (encoded as `ADC Rn, Rn`) | C, N, Z | ADC (0x6) |
| `TST` | `010010rr` | `TST Rn` | Evaluate `Rn - 0` to set flags; Rn unchanged | C, N, Z | ADD (0x4) with no write-back |

### 17.4 Register-Only Instructions (Two-Operand)

**Encoding format:** `OOOOssdd` where `OOOO` = 4-bit opcode class, `ss` = source register, `dd` = destination register. Both `ss` and `dd` use 2-bit encoding (R0=00, R1=01, R2=10).

| Mnemonic | Opcode (Binary) | Syntax | Operation | Flags Affected | ALU Function |
| --- | --- | --- | --- | --- | --- |
| `ADD` | `0110ssdd` | `ADD Rd, Rs` | `Rd = Rd + Rs` | C, N, Z | ADD (0x4) |
| `ADC` | `0111ssdd` | `ADC Rd, Rs` | `Rd = Rd + Rs + CF` | C, N, Z | ADC (0x6) |
| `SUB` | `1000ssdd` | `SUB Rd, Rs` | `Rd = Rd - Rs` | C, N, Z | ADD (via ADDS 0x5) |
| `AND` | `1001ssdd` | `AND Rd, Rs` | `Rd = Rd & Rs` | C=0, N, Z | Via NOR + COM |
| `OR` | `1010ssdd` | `OR Rd, Rs` | `Rd = Rd \| Rs` | C=0, N, Z | Via NOR + COM |
| `MUL` | `1011ssdd` | `MUL Rd, Rs` | `Rd = Rd * Rs` (signed 8-bit) | C, N, Z | Via iterative ALU seq. |
| `DIV` | `1100ssdd` | `DIV Rd, Rs` | `Rd = Rd / Rs` (signed 8-bit) | C, N, Z | Via iterative ALU seq. |
| `XOR` | `1101ssdd` | `XOR Rd, Rs` | `Rd = Rd ^ Rs` | C=0, N, Z | Via NOR + COM seq. |

### 17.5 Complex Addressing-Mode Instructions

These instructions (`MOV`, `LD`, `ST`, `CMP`, `BITT`, `BITS`, `BITC`, `LDSP`, `LDFR`, `JMP`) use a multi-byte encoding:

**Byte 1:** Destination addressing mode specifier.  
**Byte 2:** Instruction class + source addressing mode specifier.  
**Optional Bytes 3–4:** Immediate constants or absolute addresses.

#### 17.5.1 Destination Byte Encodings

| Syntax | Encoding (Byte 1) | Description |
| --- | --- | --- |
| `Rn` | `111100rr` (`0xF0` \| rr) | Direct register (R0–R2) |
| `(Rn)` | `111101rr` (`0xF4` \| rr) | Indirect through register |
| `(Rn+)` | `111110rr` (`0xF8` \| rr) | Indirect with post-increment |
| `((Rn+))` | `111111rr` (`0xFC` \| rr) | Double indirect with post-increment |
| `const` / `label` | `0xFB` followed by 8-bit immediate | Immediate constant (encoded as `(PC+)` — PC-relative load) |
| `(addr)` / `(label)` | `0xFF` followed by 8-bit address | Absolute direct address (encoded as `((PC+))` — double-indirect via PC) |

The `rr` field encodes the pointer register: R0=`00`, R1=`01`, R2=`10`.

#### 17.5.2 Instruction/Source Byte Encodings

The source byte has the format: `CCCC MM rr` where `CCCC` = 4-bit class prefix, `MM` = 2-bit mode, `rr` = 2-bit register.

**Class Prefixes (`CCCC`):**

| Class | Prefix (Hex) | Prefix (Binary) | Instructions |
| --- | --- | --- | --- |
| Load/Store/Move | `0x10` | `0001` | `MOV`, `LD`, `ST` |
| Compare | `0x20` | `0010` | `CMP` |
| Bit Test | `0x30` | `0011` | `BITT` |
| Bit Set | `0x50` | `0101` | `BITS` |
| Bit Clear | `0x60` | `0110` | `BITC` |

**Source Mode (`MM`):**

| MM | Mode | Encoding | Description |
| --- | --- | --- | --- |
| `00` | Direct register `Rn` | `prefix \| 00 \| rr` | Value from register Rn |
| `01` | Indirect `(Rn)` | `prefix \| 01 \| rr` | Value from memory at address in Rn |
| `10` | Indirect post-increment `(Rn+)` | `prefix \| 10 \| rr` | Value from memory at address in Rn, then Rn++ |
| `11` | Double indirect `((Rn+))` | `prefix \| 11 \| rr` | Value from memory at address stored in memory at Rn, then Rn++ |

**Special Source Encodings:**

| Class | Encoding | Description |
| --- | --- | --- |
| `ST` (store to absolute address) | `0x1F` followed by 8-bit addr | Source is the ALU result stored to absolute address `addr` |
| Other (load from absolute address) | `prefix \| 0x0F` followed by 8-bit addr | Source is memory at absolute address `addr` (encoded as `(PC+)`) |

#### 17.5.3 Special Instructions Using Addressing-Mode Format

| Mnemonic | Byte Sequence | Syntax | Operation | Flags |
| --- | --- | --- | --- | --- |
| `LDSP` | `[Dst Byte] 0x40` | `LDSP operand` | `SP = operand` (load stack pointer) | None |
| `LDFR` | `[Dst Byte] 0x44` | `LDFR operand` | `Flags = operand` (load flags register) | C, N, Z, IEF |
| `JMP` | `[Dst Byte] 0x13` | `JMP [operand]` | `PC = operand` (unconditional jump) | None |

Where `[Dst Byte]` is:
- `0xFB` + 8-bit value for direct jump (`JMP target`)
- `0xFF` + 8-bit addr for indirect jump (`JMP (target)`)

#### 17.5.4 Memory-Direct DEC

| Mnemonic | Opcode | Syntax | Operation | Flags |
| --- | --- | --- | --- | --- |
| `DEC (addr)` | `0x5F` followed by 8-bit `addr` | `DEC (address)` | Decrements the byte in memory at `addr` | C, N, Z |

### 17.6 Branch & Subroutine Call Instructions

All branch instructions are **2 bytes**: opcode byte + 8-bit signed offset.

**Offset calculation:** `offset = target_address - (branch_instruction_address + 2)`. The offset is a signed 8-bit value (`-128` to `+127`).

| Mnemonic | Opcode (Hex) | Opcode (Binary) | Condition | Operation |
| --- | --- | --- | --- | --- |
| `JR` | `0x20` | `00100000` | Always | `PC = PC + offset` |
| `JCS` | `0x21` | `00100001` | CF == 1 | `if (CF) PC = PC + offset` |
| `JZS` | `0x22` | `00100010` | ZF == 1 | `if (ZF) PC = PC + offset` |
| `JNS` | `0x23` | `00100011` | NF == 1 | `if (NF) PC = PC + offset` |
| `JCC` | `0x25` | `00100101` | CF == 0 | `if (!CF) PC = PC + offset` |
| `JZC` | `0x26` | `00100110` | ZF == 0 | `if (!ZF) PC = PC + offset` |
| `JNC` | `0x27` | `00100111` | NF == 0 | `if (!NF) PC = PC + offset` |

**Branch opcode bit mapping:**
- `BR[1:0]`: Condition flag select (`00`=always, `01`=CF, `10`=ZF, `11`=NF)
- `BR[2]`: Sense (`0` = branch-if-set, `1` = branch-if-clear)

| Mnemonic | `CALL` | `0x28` | 2 | `Push(PC); PC = target` | None |

### 17.7 Stack Instructions

| Mnemonic | Opcode (Binary) | Syntax | Operation | Flags |
| --- | --- | --- | --- | --- |
| `PUSH` | `000100rr` | `PUSH Rn` | `SP--; DPRAM[SP] = Rn` | None |
| `POP` | `000101rr` | `POP Rn` | `Rn = DPRAM[SP]; SP++` | None |

Where `rr` = register index (R0=00, R1=01, R2=10).

---

## 18. Assembler Directives & Source Format

### 18.1 File Format

- **First line** must be exactly: `#! mrasm`
- Comment character: `;` (rest of line ignored)
- Case-insensitive parsing (all input normalized to uppercase)
- Labels end with `:` and must be on their own line (no other tokens allowed)
- Labels must match: `/^[A-Z_][A-Z0-9_]*$/`
- Labels cannot conflict with register names (`R0`, `R1`, `R2`, `PC`) or instruction mnemonics

### 18.2 Directive Reference

| Directive | Syntax | Description |
| --- | --- | --- |
| `.ORG` | `.ORG address` | Set the assembly address pointer to `address` (0–255). |
| `.BYTE` | `.BYTE count` | Reserve `count` bytes of uninitialized memory. Advances address pointer by `count`. |
| `.DB` | `.DB val1, val2, ...` | Define byte constants. Values clamped to `-128` to `255`. Each value occupies 1 byte. |
| `.DW` | `.DW val1, val2, ...` | Define 16-bit word constants. Stored **big-endian** (high byte first). Values clamped to `0` to `65535`. Each value occupies 2 bytes. |
| `.EQU` | `.EQU symbol value` | Assign a numeric constant to a symbol. Symbol can be used anywhere a number is valid. |

### 18.3 Number Formats

| Format | Example | Description |
| --- | --- | --- |
| Decimal | `42` | Standard decimal integer |
| Binary | `0B10101010` | Binary literal (prefix `0B`) |
| Hexadecimal | `0xFF` | Hexadecimal literal (prefix `0X`) |

---

## 19. Bus & Broadcast Channel Protocol

### 19.1 Internal Bus

The internal 8-bit data bus connects:
- **Register File** (via Port A and Port B)
- **ALU** (inputs A and B, output F)
- **Memory (DPRAM)** — read/write data
- **Peripherals** — UART, Expansion board, I/O ports
- **BR (Instruction Register)** — load path

The bus is controlled by `busEn` (enable) and `busWr` (direction). When `busEn=0`, the bus is effectively tri-stated.

### 19.2 BroadcastChannel Protocol

For inter-component communication, a `BroadcastChannel` named `"memory-channel"` is used.

**Message types:**

#### `request-state`
Requests the current DPRAM contents from the emulator.
```json
{ "msg": "request-state" }
```

#### `state` (response)
Responds with the current DPRAM contents.
```json
{ "msg": "state", "data": <DPRAM Uint8Array (240 bytes)>, "architecture": "a" }
```

#### `update`
Broadcast by the emulator after every memory write (when `busEn=1` and `busWr=1`).
```json
{ "msg": "update", "data": <DPRAM Uint8Array (240 bytes)>, "architecture": "a" }
```

---

## 20. Reset & Initialization

### 20.1 Reset Sequence

When `reset()` is called, the system initializes to:

| Component | Reset State |
| --- | --- |
| **BR** | `0x00` |
| **CTRL** | All fields zeroed (`mChFlg=false, mAluS=0, mAluIA=false, mAluIB=false, mrgWE=false, mrgWS=false, mrgAA=0, mrgAB=0, busEn=false, busWr=false, nextAddr=0, mAC=0`) |
| **IFF1** | `false` |
| **IFF2** | (not explicitly reset; will be recomputed) |
| **Registers R0–R7** | All `0x00` |
| **Outputs** | `{ ff: 0x00, fe: 0x00 }` |
| **MPRAM** | Reloaded from `fillMicrocode()` function |

### 20.2 Initial Fetch

On the first `clk()` after reset:
- µPC = `getNextAddr()` with CTRL all zero → addresses Block 0, offset 0 (0x000)
- Block 0 begins the instruction fetch sequence
- PC (R3) = 0x00, so the first instruction is fetched from DPRAM address 0x00

### 20.3 Program Loading

Programs are loaded by:
1. Assembling source code via `parseASM()` → returns byte array
2. Writing the assembled bytes into DPRAM starting at the appropriate address (default: 0x00, or as specified by `.ORG`)
3. Calling `reset()` to initialize the processor state
4. Clocking via `clk()` to begin execution

---

## Appendix A: ALU Function Quick Reference

```
mAluS | Mnemonic | F =               | co =                | Used For
------|----------|-------------------|---------------------|------------------
 0000 | ADDH     | A + B             | CF || (A+B > 0xFF)   | PC increment (with carry hold)
 0001 | A        | A                 | 0                   | Pass-through, MOV
 0010 | NOR      | ~(A | B)          | 0                   | COM (when B=A), AND/OR building block
 0011 | ZERO     | 0                 | 0                   | CLR
 0100 | ADD      | A + B             | A+B > 0xFF          | ADD, LSL (B=A), SUB building block
 0101 | ADDS     | A + B + 1         | !(A+B+1 > 0xFF)    | SUB (ADDS with B=~Rs), INC
 0110 | ADC      | A + B + Cin       | A+B+Cin > 0xFF      | ADC, RLC (B=A)
 0111 | ADCS     | A + B + !Cin      | !(A+B+!Cin > 0xFF)  | SBC building block
 1000 | LSR      | A >>> 1 (0→MSB)   | A[0]                | LSR
 1001 | RR       | A >>> 1 (A[0]→MSB)| A[0]                | ROR (rotate right)
 1010 | RRC      | A >>> 1 (Cin→MSB) | A[0]                | RRC
 1011 | ASR      | A >> 1 (A[7]→MSB) | A[0]                | ASR
 1100 | B        | B                 | 0                   | MOV, clear carry
 1101 | SETC     | B                 | 1                   | Set carry flag
 1110 | BH       | B                 | Cin                 | MOV, hold carry
 1111 | INVC     | B                 | !Cin                | Invert carry flag
```

## Appendix B: Microcode Block Quick Reference

| Block | Address Range | Primary Instructions |
| --- | --- | --- |
| 0 | 0x000–0x01F | RESET, Instruction Fetch, STOP, NOP, EI, DI, PUSH, POP, RET, PUSHF, POPF |
| 1 | 0x020–0x03F | CLR, INC, DEC, NEG, COM, LSR, ASR, TST |
| 2 | 0x040–0x05F | MOV, LD, ST (addressing mode dispatch) |
| 3 | 0x060–0x07F | ADD, ADC, SUB |
| 4 | 0x080–0x09F | AND, OR, XOR, EI, DI, RET, RETI, PUSHF, POPF, STOP, NOP |
| 5 | 0x0A0–0x0BF | CMP (compare class) |
| 6 | 0x0C0–0x0DF | BITT (bit test class) |
| 7 | 0x0E0–0x0FF | BITS (bit set class) |
| 8 | 0x100–0x11F | BITC Part 1 (bit clear class) |
| 9 | 0x120–0x13F | BITC Part 2 |
| 10 | 0x140–0x15F | JCS, JCC, JZS, JZC, JNS, JNC, JR (conditional branches) |
| 11 | 0x160–0x17F | CALL |
| 12 | 0x180–0x19F | RET |
| 13 | 0x1A0–0x1BF | RETI |
| 14 | 0x1C0–0x1DF | Interrupt handler, HALT/STOP state |
| 15 | 0x1E0–0x1FF | MUL, DIV |

## Appendix C: Memory Map Quick Reference

| Address | Read | Write |
| --- | --- | --- |
| 0x00–0xEF | DPRAM (instruction/data) | DPRAM (instruction/data) |
| 0xF0–0xF3 | Expansion board (`readMinibus(0-3)`) | Expansion board (`writeMinibus(0-3, data)`) |
| 0xF4–0xF9 | Reserved / DAC | Reserved / DAC |
| 0xFA | UART Rx Data Register | UART Tx Buffer |
| 0xFB | UART Status Register | UART Control Register |
| 0xFC | Input Port 0 | (no effect) |
| 0xFD | Input Port 1 | (no effect) |
| 0xFE | Output Register 0 (read-back) | Output Register 0 (set) |
| 0xFF | Output Register 1 (read-back) | Output Register 1 (set) |

---

*Document Version: 2.0*  
*Last Updated: 2026-07-26*  
*Based on: JavaScript emulator implementation (`js/2a.js`), ALU component tests, system integration tests, SVG datapath diagrams, and original specification v1.0.*