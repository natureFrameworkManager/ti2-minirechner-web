#! mrasm

; Writes 0xFFs to the analog outputs of the mr2da2

    .ORG 0

    ; Set digital / analog outputs on the mr2da2
    MOV (0xF0), 0xFF
    MOV (0xF1), 0xFF

    ; Set ui/o directions to output
    MOV (0xF2), 0b10000111
    ; Set all ui/os to high
    MOV (0xF2), 0b00000111

    ; Read status information
    MOV (0xFF), (0xF1)
    STOP

; test-result: FB FF 1F F0 FB FF 1F F1 FB 87 1F F2 FB 07 1F F2 FF F1 1F FF 01