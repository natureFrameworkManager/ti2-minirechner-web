#! mrasm

LOOP:
    LD R0, 42
LOOP:
    INC R0
    JZC LOOP
    JR FIRST_LINE

; test-result: false