// NumberHelper.ts
//
// Utility functions for formatting and parsing numbers across the UI.
// Handles thousands separators (locale-aware via toLocaleString) and
// compact notation (K, M, B, T suffixes) for displaying large values
// like gold, XP, or damage in a readable way.
//
// The rounding modes (ceil/round/floor via `updown`) matter because
// the game rounds differently by context: reward previews round down
// to avoid overpromising, cost displays round up to avoid underpaying.
//
// Used by: HHMenuHelper (input formatting), RewardHelper (reward
//          display), InfoService (player info panel)

/** Event handler for menu inputs that auto-formats with thousands separators. */
export function add1000sSeparator1()
{
    var nToFormat = this.value;
    this.value = NumberHelper.add1000sSeparator(nToFormat);
}

export class NumberHelper {

    static add1000sSeparator(nToFormat:string)
    {
        return NumberHelper.nThousand(NumberHelper.remove1000sSeparator(nToFormat));
    }

    static remove1000sSeparator(nToFormat:string)
    {
        return Number(nToFormat.replace(/\D/g, ''));
    }

    static nThousand(x) {
        if (typeof x != 'number') {
            x = 0;
        }
        return x.toLocaleString();
    }

    // Numbers: rounding to K, M, G and T
    static nRounding(num:number, digits:number, updown:number) {
        var power = [
            { value: 1, symbol: '' },
            { value: 1E3, symbol: 'K' },
            { value: 1E6, symbol: 'M' },
            { value: 1E9, symbol: 'B' },
            { value: 1E12, symbol: 'T' },
        ];
        var i:number;
        for (i = power.length - 1; i > 0; i--) {
            if (num >= power[i].value) {
                break;
            }
        }
        if (updown == 1) {
            return (Math.ceil(num / power[i].value * Math.pow(10, digits)) / Math.pow(10, digits)).toFixed(digits) + power[i].symbol;
        }
        else if (updown == 0) {
            return (Math.round(num / power[i].value * Math.pow(10, digits)) / Math.pow(10, digits)).toFixed(digits) + power[i].symbol;
        }
        else if (updown == -1) {
            return (Math.floor(num / power[i].value * Math.pow(10, digits)) / Math.pow(10, digits)).toFixed(digits) + power[i].symbol;
        }
    }
}