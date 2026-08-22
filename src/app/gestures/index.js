// Alle Register-Gesten dieser Anwendung, in einer Datei je Geste. Neue Geste
// hinzufügen: neue Datei nach demselben Muster + hier importieren/eintragen.
import { subBass } from "./sub-bass.js";
import { bass }    from "./bass.js";
import { lowMid }  from "./low-mid.js";
import { mid }     from "./mid.js";
import { hiMid }   from "./hi-mid.js";
import { high }    from "./high.js";

export const REGISTERS = [subBass, bass, lowMid, mid, hiMid, high];
