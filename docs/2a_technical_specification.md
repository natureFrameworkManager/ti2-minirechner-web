## 1. Architectural Overview
* **Word Size:** 8-bit
* **Endianness:** Big-endian for multibyte assembler directives (high byte stored first/at lower address). No hardware-level multibyte operations.
* **Address Space:** 8-bit unified address space (0x00 to 0xFF, 256 bytes) containing both instructions and data (Von Neumann architecture).
* **Memory Map:**
  | Address Range | Access Type | Purpose / Description |
  | --- | --- | --- |
  | 0x00 - 0xEF | R/W | Unified Instruction and Data RAM (DPRAM) |
  | 0xF0 - 0xF9 | R/W | Reserved / Peripheral I/O space / Digital-to-Analog Converters (DAC) |
  | 0xFA | R/W | UART Interface: Read: Receive Register (RxD), Write: Transmit Buffer (TxD) |
  | 0xFB | R/W | UART Interface: Read: Status Register, Write: Control Register |
  | 0xFC - 0xFD | R | General-purpose input keys/ports (read-only) |
  | 0xFE - 0xFF | R/W | Read: General-purpose input ports / Write: Output indicators/registers |

## 2. Register File
| Register Name | Width (bits) | Type/Purpose | ABI Role |
| --- | --- | --- | --- |
| R0 | 8 | General-purpose | Parameter passing, return values, caller-saved |
| R1 | 8 | General-purpose | Parameter passing, caller-saved |
| R2 | 8 | General-purpose | General scratch, caller-saved_ |
| PC (R3) | 8 | Program Counter | Points to the next instruction byte |
| Flags (R4) | 8 | Processor Status | Status flags register (Carry, Zero, Negative, Interrupt Enable) |
| SP (R5) | 8 | Stack Pointer | Points to the top of the pre-decrement call stack |
| R6 | 8 | Microcode Temporary | Internal use by microcode only; not assembly addressable |
| R7 | 8 | Microcode Temporary | Internal use by microcode only; not assembly addressable |

**Flags Register (R4) Layout:**
`0b0000.IEF.NF.ZF.CF`
* **Bit 0 (CF):** Carry Flag. Set on arithmetic carry-out or underflow.
* **Bit 1 (ZF):** Zero Flag. Set if the ALU output is zero.
* **Bit 2 (NF):** Negative Flag. Set if the MSB (bit 7) of the ALU output is 1.
* **Bit 3 (IEF):** Interrupt Enable Flag. Global interrupt master switch.

## 3. Calling Convention & ABI
* **Stack Growth:** Downward (Pre-decrement, post-increment).
  * `PUSH` / `CALL` decrements `SP` by 1 before writing to memory: `SP = SP - 1; Memory[SP] = value`.
  * `POP` / `RET` reads from memory at `SP`, then increments `SP` by 1: `value = Memory[SP]; SP = SP + 1`.
* **Argument Passing:** Arguments are passed in registers starting with `R0`, then `R1`, then `R2`.
* **Stack Alignment:** 1 byte (unified byte addressability).
* **Return Values:** Returned in `R0`.
* **Interrupt Execution Flow:**
  * When an interrupt is triggered, the CPU hardware:
    1. Decrements SP and pushes the 8-bit Return Address (PC).
    2. Decrements SP and pushes the 8-bit `Flags` register.
    3. Clears the `IEF` flag to disable further interrupts.
    4. Branches to the Interrupt Service Routine (ISR) address.
  * The `RETI` instruction restores execution by:
    1. Popping the 8-bit `Flags` register from the stack.
    2. Popping the 8-bit Return Address (PC) from the stack.

## 4. Instruction Set Architecture (ISA)
This section contains all instructions supported by the architecture's assembler.

### Zero-Operand & Simple Control Instructions
| Mnemonic | Opcode / Binary Format | Syntax | Operation (Pseudocode) | Flags Affected |
| --- | --- | --- | --- | --- |
| STOP | `0x01` | `STOP` | Halt execution / clock loop | None |
| NOP | `0x02` | `NOP` | No operation | None |
| EI | `0x08` | `EI` | Enable Interrupts: `IEF = 1` | IEF |
| DI | `0x0C` | `DI` | Disable Interrupts: `IEF = 0` | IEF |
| RET | `0x17` | `RET` | Return from Subroutine: `PC = Pop()` | None |
| RETI | `0x2C` | `RETI` | Return from Interrupt: `Flags = Pop(); PC = Pop()` | C, N, Z, IEF |
| PUSHF | `0x18` | `PUSHF` | Push Flags register to stack: `Push(Flags)` | None |
| POPF | `0x1C` | `POPF` | Pop Flags register from stack: `Flags = Pop()` | C, N, Z, IEF |

### Register-Only Core Instructions
*Operators or registers are encoded using `rr`/`dd`/`ss` where `R0 = 00`, `R1 = 01`, `R2 = 10`.*
| Mnemonic | Opcode / Binary Format | Operands & Syntax | Operation (Pseudocode / RTL) | Flags Affected |
| --- | --- | --- | --- | --- |
| CLR | `000001rr` | `CLR Rn` | `Rn = 0` | C, N, Z (C=0, N=0, Z=1) |
| INC | `010001rr` | `INC Rn` | `Rn = Rn + 1` | C, N, Z |
| DEC | `010100rr` | `DEC Rn` | `Rn = Rn - 1` | C, N, Z |
| NEG | `001101rr` | `NEG Rn` | `Rn = -Rn` | C, N, Z |
| COM | `001100rr` | `COM Rn` | `Rn = ~Rn` | C, N, Z (C=0) |
| LSR | `001110rr` | `LSR Rn` | `C = Rn[0]; Rn = Rn >>> 1` | C, N, Z |
| ASR | `001111rr` | `ASR Rn` | `C = Rn[0]; Rn = Rn >> 1` | C, N, Z |
| LSL | `0110ssdd` (with $ss = dd$) | `LSL Rn` | `Rn = Rn << 1` (Encoded as `ADD Rn, Rn`) | C, N, Z |
| RRC | `010000rr` | `RRC Rn` | `temp = Rn[0]; Rn = (CF << 7) \| (Rn >>> 1); CF = temp` | C, N, Z |
| RLC | `0111ssdd` (with $ss = dd$) | `RLC Rn` | Rotate left through carry (Encoded as `ADC Rn, Rn`) | C, N, Z |
| TST | `010010rr` | `TST Rn` | Evaluate `Rn - 0` to set flags without writing | C, N, Z |
| ADD | `0110ssdd` | `ADD Rd, Rs` | `Rd = Rd + Rs` | C, N, Z |
| ADC | `0111ssdd` | `ADC Rd, Rs` | `Rd = Rd + Rs + CF` | C, N, Z |
| SUB | `1000ssdd` | `SUB Rd, Rs` | `Rd = Rd - Rs` | C, N, Z |
| AND | `1001ssdd` | `AND Rd, Rs` | `Rd = Rd & Rs` | C, N, Z (C=0) |
| OR | `1010ssdd` | `OR Rd, Rs` | `Rd = Rd \| Rs` | C, N, Z (C=0) |
| MUL | `1011ssdd` | `MUL Rd, Rs` | `Rd = Rd * Rs` | C, N, Z |
| DIV | `1100ssdd` | `DIV Rd, Rs` | `Rd = Rd / Rs` | C, N, Z |
| XOR | `1101ssdd` | `XOR Rd, Rs` | `Rd = Rd ^ Rs` | C, N, Z (C=0) |
| PUSH | `000100rr` | `PUSH Rn` | `Push(Rn)` | None |
| POP | `000101rr` | `POP Rn` | `Rn = Pop()` | None |

### Branch & Subroutine Call Instructions
| Mnemonic | Opcode / Binary Format | Operands & Syntax | Operation (Pseudocode / RTL) | Flags Affected |
| --- | --- | --- | --- | --- |
| CALL | `0x28` followed by 8-bit `address` | `CALL label / address` | `Push(PC); PC = target` | None |
| JR | `0x20` followed by 8-bit signed `offset` | `JR label / offset` | Unconditional relative branch: `PC = PC + offset` | None |
| JCS | `0x21` followed by 8-bit signed `offset` | `JCS label / offset` | Branch if Carry Set (`CF == 1`): `if (CF) PC = PC + offset` | None |
| JZS | `0x22` followed by 8-bit signed `offset` | `JZS label / offset` | Branch if Zero Set (`ZF == 1`): `if (ZF) PC = PC + offset` | None |
| JNS | `0x23` followed by 8-bit signed `offset` | `JNS label / offset` | Branch if Neg Set (`NF == 1`): `if (NF) PC = PC + offset` | None |
| JCC | `0x25` followed by 8-bit signed `offset` | `JCC label / offset` | Branch if Carry Clear (`CF == 0`): `if (!CF) PC = PC + offset` | None |
| JZC | `0x26` followed by 8-bit signed `offset` | `JZC label / offset` | Branch if Zero Clear (`ZF == 0`): `if (!ZF) PC = PC + offset` | None |
| JNC | `0x27` followed by 8-bit signed `offset` | `JNC label / offset` | Branch if Neg Clear (`NF == 0`): `if (!NF) PC = PC + offset` | None |

*Note: For relative branches, the conditional offset is 8-bit signed and calculated as `target - (branch_addr + 2)`.*

### Addressing-Mode-Based Complex Instructions
These instructions (`MOV`, `LD`, `ST`, `CMP`, `BITT`, `BITS`, `BITC`, `LDSP`, `LDFR`, `JMP`) use a flexible two-byte or multibyte structure consisting of:
1. **Destination byte** (specifying destination addressing mode and register/value)
2. **Instruction/Source byte** (specifying instruction opcode class and source addressing mode and register/value)
3. Any optional intermediate bytes if constants or direct addresses are used.

#### Destination Byte Encodings (Byte 1)
| Destination Mnemonic Group / Syntax | Opcode / Binary Format | Description |
| --- | --- | --- |
| `Rn` | `111100rr` | Direct register `Rn` ($R0..R2$) |
| `(Rn)` | `111101rr` | Indirect register `(Rn)` ($R0..R2$) |
| `(Rn+)` | `111110rr` | Indirect register with post-increment `(Rn+)` ($R0..R2$) |
| `((Rn+))` | `111111rr` | Double indirect with post-increment `((Rn+))` ($R0..R2$) |
| `const` or `label` | `0b11111011` (`0xFB`) followed by 8-bit `const` | Immediate constant via `(PC+)` |
| `(addr)` or `(label)` | `0b11111111` (`0xFF`) followed by 8-bit `addr` | Absolute direct address via `((PC+))` |

#### Instruction & Source Byte Encodings (Byte 2)
The raw source byte is formed as `Class Prefix (bits 7-4) \| Mode (bits 3-2) \| Source Register (bits 1-0)`.
- **Class Prefixes:**
  - `MOV`, `LD`, `ST`: `0b00010000` (`0x10`)
  - `CMP`: `0b00100000` (`0x20`)
  - `BITT` (Bit Test): `0b00110000` (`0x30`)
  - `BITS` (Bit Set): `0b01010000` (`0x50`)
  - `BITC` (Bit Clear): `0b01100000` (`0x60`)
- **Source Operand Modes:**
  - `Rn` (direct): `0b0000 \| rr` -> `0rr` (e.g. `0x10` for R0, `0x11` for R1, `0x12` for R2)
  - `(Rn)` (indirect): `0b0100 \| rr` -> `1rr` (e.g. `0x14` for R0, `0x15` for R1, `0x16` for R2)
  - `(Rn+)` (post-increment): `0b1000 \| rr` -> `2rr` (e.g. `0x18` for R0, `0x19` for R1, `0x1A` for R2)
  - `((Rn+))` (double indirect): `0b1100 \| rr` -> `3rr` (e.g. `0x1C` for R0, `0x1D` for R1, `0x1E` for R2)
  - `(addr)` / `(label)` Direct:
    - For `ST`: `0b00011111` (`0x1F`) followed by 8-bit address byte.
    - Otherwise: `Class Prefix \| 0b00001111` followed by 8-bit address byte.

#### Special Addressing-Mode Instructions
| Mnemonic | Structure (Sequential Bytes) | Syntax | Operation | Flags Affected |
| --- | --- | --- | --- | --- |
| LDSP | `[Dst Byte] 0x40` | `LDSP operand` | Load stack pointer `SP = operand` | None |
| LDFR | `[Dst Byte] 0x44` | `LDFR operand` | Load Flags register `Flags = operand` | C, N, Z, IEF |
| JMP | `[Dst Byte] 0x13` (where direct is `0xFB` and indirect is `0xFF`) | `JMP [operand]` / `JMP ([operand])` | Unconditional jump: `PC = operand` | None |
| DEC | `0x5F` followed by 8-bit `addr` | `DEC (address)` | Decrements byte in memory at `addr` | C, N, Z |

## 5. Assembler Directives
* `.ORG target`: Sets the active program assembly memory-load address to `target` (range `0` to `255`).
* `.BYTE size`: Declares a block of uninitialized memory of `size` bytes, advancing the assembler address pointer.
* `.DB val1, val2...`: Defines and inserts one or more 8-bit byte constants sequentially into memory. Values must range from `-128` to `255`.
* `.DW val1, val2...`: Defines and inserts one or more 16-bit word constants sequentially into memory. Stored using **Big-endian** formatting (high byte first, then low byte). Values must range from `0` to `65535`.
* `.EQU label val`: Assigns an 8-bit integer constant `val` to `label` symbol for alias lookup during assembly.
* `;`: Prefix indicator for comments; all characters following it on the line are ignored.
* `#! mrasm`: Header signature. Must be the exact first line of any valid source file.
