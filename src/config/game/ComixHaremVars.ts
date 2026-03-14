// Game-variant configuration for Comix Harem.
// Provides domain-to-environment mapping, troll names, and quest data
// specific to the Comix Harem game variant.

export class ComixHarem {
    static spreadsheet = 'https://docs.google.com/spreadsheets/d/1kVZxcZZMa82lS4k-IpxTTTELAeaipjR_v1twlqW5vbI'; // zoopokemon
    static trollIdMapping = {};
    static lastQuestId = -1; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.comixharem.com": { name: "CH_prod", id: "hh_comix", baseImgPath: "https://ch.hh-content.com" },
            "nutaku.comixharem.com": {name:"NCH_prod",id:"hh_comix"}
        }
    }
    static getTrolls(languageCode: string) {
        const trollList = ['Latest',
            'BodyHack',
            'Grey Golem',
            'The Nymph',
            'Athicus Ho’ole',
            'The Mimic',
            'Cockatrice',
            'Pomelo',
            'Alexa Sl\'Thor',
            'D\'KLONG',
            'Virtue Man',
            'Asmodea',
            'Blueball Gremlin',
            'Oblivia'];

        switch (languageCode) {
            case "fr":
                trollList[12] = 'Gremlin Couill\'bleues';
                break;
        }
        return trollList;
    }
    static getTrollGirlsId() {
        return [
            [['830009523', '907801218', '943323021'], [0], [0]],
            [['271746999', '303805209', '701946373'], [0], [0]],
            [['743748788', '977228200', '943323021'], [0], [0]],
            [['140401381', '232860230', '514994766'], [0], [0]],
            [['623293037', '764791769', '801271903'], [0], [0]],
            [['921365371', '942523553', '973271744'], [0], [0]],
            [['364639341', '879781833', '895546748'], [0], [0]],
            [['148877065', '218927643', '340369336'], [0], [0]],
            [['258185125', '897951171', '971686222'], [0], [0]],
            [['125758004', '233499841', '647307160'], [0], [0]],
            [['994555359', '705713849', '973778141'], [0], [0]],
            [['986074436', '151807422', '993438296'], [0], [0]],
            [['629181593', '686202051', '107847932'], [0], [0]],
        ];
    }
    static updateFeatures(envVariables: any) {
    }
}