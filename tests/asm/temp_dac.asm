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
    BITT (0xF1), 0x10 ; bit test
    JZS LOWER       ; temp should be lower, else higher
    MOV R0, R2      ; move average to min
    INC R0          ; inc by 1 to round up 
    JR LOOP         ; repeat
LOWER:
    MOV R1, R2      ; move average to max
    JR LOOP         ; repeat
OUTPUT:
    ST (0xFF), R0   ; print result
    CMP R0, (0xFD)  ; if first case
    JCS LOWER_TRESHOLD
    CMP R0, (0xFC)  ; if second case
    JCS UPPER_TRESHOLD
    LD R1, (0xFE)
    ST (0xF0), R1   ; else
    ST (0xFE), R1
    JR MAIN         ; start over
LOWER_TRESHOLD:
    LD R1, 0x0
    ST (0xF0), R1
    ST (0xFE), R1
    JR MAIN         ; start over
UPPER_TRESHOLD:
    LD R1, (0xFF)
    ST (0xF0), R1
    ST (0xFE), R1
    JR MAIN         ; start over

; test-result: FB 00 10 FB FF 11 F1 20 22 16 F0 12 66 42 F2 1F F1 FB 10 3F F1 22 05 F2 10 44 20 EA F2 11 20 E6 F0 1F FF FF FD 20 21 10 FF FC 20 21 16 FF FE 11 F1 1F F0 F1 1F FE 20 C8 FB 00 11 F1 1F F0 F1 1F FE 20 BD FF FF 11 F1 1F F0 F1 1F FE 20 B2