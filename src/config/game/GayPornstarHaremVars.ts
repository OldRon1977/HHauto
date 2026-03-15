// Game-variant configuration for Gay Pornstar Harem.
// Provides domain-to-environment mapping, troll ID remapping, troll names,
// and quest data specific to the Gay Pornstar Harem game variant.

export class GayPornstarHarem {
    static spreadsheet = 'https://docs.google.com/spreadsheets/d/1kVZxcZZMa82lS4k-IpxTTTELAeaipjR_v1twlqW5vbI'; // Cuervos & Sandor
    static trollIdMapping = { 6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 7, 12: 8 };
    static lastQuestId = -1; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.gaypornstarharem.com": { name: "GPSH_prod", id: "hh_stargay", baseImgPath: "https://images.hh-content.com/stargay" },
            "nutaku.gaypornstarharem.com": { name: "NGPSH_prod", id: "hh_stargay", baseImgPath: "https://images.hh-content.com/stargay" }
        }
    }

    static getTrolls(languageCode: string) {
        return ['Latest',
            'Tristan Hunter',
            'Jimmy Durano',
            'Lucca Mazzi',
            'Andrew Stark',
            'Sean Duran & Bryce Evans',
            'Trojan Pierce Paris',
            'Ryan Rose',
            'Pol Prince'];
    }

    static getTrollGirlsId() {
        return [
            [['780402171', '374763633', '485499759'], [0], [0]],
            [[0], [0], [0]],
            [[0], [0], [0]],
            [[0], [0], [0]],
            [['290465722', '524315573', '970767946'], [0], [0]],
            [['127881092', '680366759', '836998610'], [0], [0]],
            [['182117271', '350309796', '361432643', '390918673', '426008459', '446246345', '590934200', '599355011', '712652761', '848616605', '921769175'], [0], [0]],
            [['284712878', '913932535', '352737504 '], [0], [0]],
            [['268000414', '809099695'], [0], [0]],
            [['578185725', '582322108', '695550243'], [0], [0]],
            [['316283043', '856464976', '619419056'], [0], [0]],
        ];
    }

    static updateFeatures(envVariables: any) {
    }
}