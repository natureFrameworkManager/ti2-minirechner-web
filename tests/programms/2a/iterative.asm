#! mrasm
    LDSP 0xEF   ; init stackpointer
LOOP:
    LD R0, (0xFF)
    LD R1, 1        ; a = 0
    CLR R2          ; b = 1
FIB:
    DEC R0
    CMP R0, 0
    JNS ECHO
    PUSH R0
    MOV R0, R1      ; temp = a
    ADD R0, R2      ; temp = temp + b
    MOV R1, R2      ; a = b
    MOV R2, R0      ; b = temp
    POP R0
    JR FIB
ECHO:
    ST (0xFF), R2
    STOP