#! mrasm

FIRST_LINE:
LOOP:
    LD R0, 42
    INC R0
    JZS LOOP
    JR FIRST_LINE

; test-result: FB 2A 10 44 22 FA 20 F8