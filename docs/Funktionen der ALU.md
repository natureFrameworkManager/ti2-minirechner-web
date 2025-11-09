# Funktionen der ALU
| Steuereingänge | Befehl | allg. Befehl bei B = A | Funktion | C | N | Z |Bemerkung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00 00 | ADDH | LSLH | F = A + B | OR | * | * | add and hold carry: C = Cin $\vee$ C |
| 00  01 | A | - | F = A | 0 | * | * | Eingang A durchreichen |
| 00  10 | NOR | COM | F = A NOR B | 0 | * | * | bei B = A: complement |
| 00  11 | 0 | - | F = 0 | 0 | 0 | 1 | Ergebnis immer 0 |
| 01  00 | ADD | LSL | F = A + B | Ca | * | * | bei B = A: logical shift left |
| 01  01 | ADDS | (SL1) | F = A + B + 1 | $\overline{Ca}$ | * | * | add for subtraction bei B = A: shift left, rechts 1 einschieben |
| 01  10 | ADC | RLC | F = A + B + Cin | Ca | * | * | add with carry bei B = A: rotate left through carry |
| 01  11 | ADCS | - | F = A + B + $\overline{Cin}$ | $\overline{Ca}$ | * | * | add with carry for subtraction |
| 10  00 | LSR | - | F(n) = A(n + 1), F(7) = 0 | A(0) | * | * | logical shift right, links 0 einschieben |
| 10  01 | RR | - | F(n) = A(n + 1), F(7) = A(0) | A(0) | * | * | rotate right |
| 10  10 | RRC | - | F(n) = A(n + 1), F(7) =Cin | A(0) | * | * | rotate right through carry |
| 10  11 | ASR | - | F(n) = A(n + 1), F(7) = A(7) | A(0) | * | * | arithmetic shift right |
| 11  00 | B | CLC | - F = B | 0 | * | * | Eingang B durchreichen clear carry flag |
| 11  01 | SETC | - | F = B | 1 | * | * | set carry flag |
| 11  10 | BH | - | F = B | Cin | * | * | B and hold carry flag |
| 11  11 | INVC | - | F = B | $\overline{Cin}$ | * | * | invert carry flag |

- A, B = Dateneingänge (Signed 8-Bit Integer)
- F = Ergebnis
- C = carry out
- N = negative out
- Z = zero out
- \* = entsprechend dem Ergebnis F
- Cin = Carry input in ALU
- Ca = Carry aus Addierer
- $\overline{x}$ = Signal x invertiert