// Game-variant configuration for Pornstar Harem.
// Provides domain-to-environment mapping, troll ID remapping, troll names,
// and quest data specific to the Pornstar Harem game variant.

export class PornstarHarem {
    static trollIdMapping = { 10: 9, 14: 11, 16: 12, 18: 13, 20: 14, 23: 15, 26: 17 }; // under 10 id as usual
    static lastQuestId = 16100; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.pornstarharem.com": { name: "PH_prod", id: "hh_star", baseImgPath: "https://th.hh-content.com" },
            "nutaku.pornstarharem.com": { name: "NPH_prod", id: "hh_star", baseImgPath: "https://th.hh-content.com" }
        }
    }

    static getTrolls(languageCode: string) {
       const trollList = ['Latest',
                    'Headmistress Asa Akira',
                    'Sammy Jayne',
                    'Ivy Winters',
                    'Sophia  Jade',
                    'Amia Miley',
                    'Alyssa Reece',
                    'Kelly Kline',
                    'Jamie Brooks',
                    'Jordan Kingsley',
                    'EMPTY',
                    'Sierra Sinn',
                    'Jasmine Jae',
                    'Bella Rose',
                    'Paige Taylor',
                    'The Hooded Heroine',
                    'EMPTY',
                    'Monica Mattos',
                    'Caty Campbell'];

        switch (languageCode) {
            case "fr":
                trollList[1] = 'Directrice Asa Akira';
                trollList[15] = 'L\'héroïne encapuchonnée';
                break;
        }
        return trollList;
    }

    static getTrollGirlsId() {
        return [
            [['261345306', '795788039', '973280579'], [0], [0]],
            [['482529771', '658322339', '833308213'], [0], [0]],
            [['117837840', '160370794', '306287449', '828011942'], [0], [0]],
            [['564593641', '719705773', '934421949'], [0], [0]],
            [['270611414', '464811282', '781232070'], [0], [0]],
            [['219241809', '380385497', '879198752'], [0], [0]],
            [['165066536', '734325005', '805020628'], [0], [0]],
            [['191661045', '369105612', '665836932'], [0], [0]],
            [['169356639', '383702874', '943667167'], [0], [0]],
            [[0], [0], [0]],
            [['169741198', '459885596', '507702178'], [0], [0]],
            [['258984943', '837109131', '888135956'], [0], [0]],
            [['270920965', '600910475', '799448349'], [0], [0]],
            [['832031905', '272818756', '477487889'], [0], [0]],
            [['814814392', '660703295', '450943401'], [0], [0]],
            [[0], [0], [0]],
            [['409433993', '438706084', '673600948'], [0], [0]],
            [['248370930', '257485641', '381828319'], [0], [0]],
        ];
    }

    static updateFeatures(envVariables: any) {
        envVariables.isEnabledSpreadsheets = false;
    }
}