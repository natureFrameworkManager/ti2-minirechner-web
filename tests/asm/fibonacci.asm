#! mrasm
    *STACKSIZE 32
    LDSP 0xEF   ; init stackpointer
LOOP:           ; while (true)
    LD R0, (0xFF)
    CMP R0, 7   ; check for error with N=6
    JNC ERR     ; throw error if n >= N
    CALL FIB    ; fib(n)
    ST (0xFF), R0
    JR LOOP     ; repeat
FIB:
    CMP R0, 2
    JNS IF      ; if n < 2
    DEC R0      ; n -= 1
    PUSH R0     ; push n-1
    CALL FIB    ; fib(n - 1)
    POP R1      ; restore n-1
    PUSH R0     ; push a
    MOV R0, R1  ; move n
    DEC R0      ; n -= 1
    CALL FIB    ; fib(n - 2)
    POP R1      ; pop a
    ADD R0, R1  ; b = b + a
IF:
    RET         ; return value
ERR:
    LD R0, 0
    ST (0xFF), R0
    JR LOOP

; test-result: FB EF 40 FF FF 10 FB 07 20 27 1A 28 12 F0 1F FF 20 F1 FB 02 20 23 0D 50 10 28 12 15 10 F1 10 50 28 12 15 64 17 FB 00 10 F0 1F FF 20 D6