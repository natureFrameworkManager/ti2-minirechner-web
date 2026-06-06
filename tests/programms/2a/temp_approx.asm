#! mrasm
MAIN: 
    LD R0, 0x00     ; temp min
    LD R1, 0xFF     ; temp max
LOOP:               ; while (true)
    CMP R0, R1
    JZS OUTPUT      ; if min == max
    ; average algo. based on the following devblog:
    ; https://devblogs.microsoft.com/oldnewthing/
    ; 20220207-00/?p=106223
    MOV R2, R0      ; temp = a
    ADD R2, R1      ; temp += b
    RRC R2          ; temp >> 1 + c*2^7
    ST (0xF1), R2   ; compare temp to average
    BITT (0xF1), 0b100 ; bit test
    JZS LOWER       ; temp should be lower, else higher
    MOV R0, R2      ; move average to min
    INC R0          ; inc by 1 to round up 
    JR LOOP         ; repeat
LOWER:
    MOV R1, R2      ; move average to max
    JR LOOP         ; repeat
OUTPUT:
    ST (0xFF), R0   ; print result
    STOP