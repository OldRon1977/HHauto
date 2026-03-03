export class MangaRpg {
    static trollIdMapping = { 3: 3 };
    static lastQuestId = -1; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.mangarpg.com": { name: "MRPG_prod", id: "hh_mangarpg", baseImgPath: "https://mh.hh-content.com" },
            "nutaku.mangarpg.com": { name: "NMRPG_prod", id: "hh_mangarpg", baseImgPath: "https://mh.hh-content.com" }
        }
    }
    static getTrolls(languageCode: string) {
        return ['Latest',
            'Jeshtar',
            'EMPTY',
            'Troll Hound'];
    }

    static getTrollGirlsId() {
        return [
            [[0], [0], [0]],
            [[0], [0], [0]],
            [['355325809', '417946225', '860641919'], [0], [0]],
        ];
    }

    static updateFeatures(envVariables: any) {
        envVariables.isEnabledPantheon = false;// to remove when Pantheon arrives in Manga RPG
        envVariables.isEnabledBossBangEvent = false;// to remove when event arrives in Manga RPG
        envVariables.isEnabledSultryMysteriesEvent = false;// to remove when event arrives in Manga RPG
        envVariables.isEnabledSpreadsheets = false;
    }
}