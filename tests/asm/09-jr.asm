#! mrasm

    CLR R0
LOOP:
    INC R0
    ST (0xFF), R0
    JR LOOP

; test-result: 04 44 F0 1F FF 20 FA