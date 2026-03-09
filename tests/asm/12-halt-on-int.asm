#! mrasm

.ORG 0             ; Programme starten an Adresse 0

JR MAIN            ; Springe zur Hauptroutine
JR INTERRUPT       ; Die Interrupt-Routine startet hier

MAIN:
    EI             ; Erlaube Interrupts (Enable Interrupt)
    BITS (0xF9), 1 ; Setze Master Interrupt Control Register
    LDSP 0xEF      ; Definiere den Stackpointer
LOOP:              ; Endlosschleife
    JR LOOP

INTERRUPT:
    STOP           ; Anhalten der Maschine
    RETI           ; Kehre vom Interrupt zurueck (hier unerreichbar)

; test-result: 20 02 20 0A 08 FB 01 5F F9 FB EF 40 20 FE 01 2C