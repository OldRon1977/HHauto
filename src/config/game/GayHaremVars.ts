// Game-variant configuration for Gay Harem.
// Provides domain-to-environment mapping, troll names, and quest data
// specific to the Gay Harem game variant.

export class GayHarem {
    static spreadsheet = 'https://docs.google.com/spreadsheets/d/1kVZxcZZMa82lS4k-IpxTTTELAeaipjR_v1twlqW5vbI'; // Bella
    static trollIdMapping = {};
    static lastQuestId = -1; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.gayharem.com": { name: "GH_prod", id: "hh_gay" },
            "nutaku.gayharem.com": { name: "NGH_prod", id: "hh_gay" },
            "eroges.gayharem.com": { name: "EGH_prod", id: "hh_gay" }
        }
    }

    static getTrolls(languageCode: string) {
        const trollList = ['Latest',
            'Dark Lord',
            'Ninja Spy',
            'Gruntt',
            'Edward',
            'Donatien',
            'Silvanus',
            'Bremen',
            'Edernas',
            'Fredy Sih Roko Senseï',
            'Maro',
            'Jackson&#8217;s Crew',
            'Icarus Warlock',
            'Sol',
            'Soju'];

        switch (languageCode) {
            case "fr":
                trollList[2] = 'Espion Ninja';
                trollList[11] = 'Éq. de Jackson';
                trollList[12] = 'Sorcier Icarus';
                break;
            case "de":
                trollList[1] = 'Dunkler Lor';
                trollList[2] = 'Ninjaspion';
                trollList[11] = 'Jacksons Crew';
                break;
        }
        return trollList;
    }

    static getTrollGirlsId() {
        return [
            [['8', '9', '10'], ['7270263'], ['979916751']],
            [['14', '13', '12'], ['318292466'], ['936580004']],
            [['19', '16', '18'], ['610468472'], ['54950499']],
            [['29', '28', '26'], ['4749652'], ['345655744']],
            [['39', '40', '41'], ['267784162'], ['763020698']],
            [['64', '63', '31'], ['406004250'], ['864899873']],
            [['85', '86', '84'], ['267120960'], ['536361248']],
            [['114', '115', '116'], ['379441499'], ['447396000']],
            [['1247315', '4649579', '7968301'], ['46227677'], ['933487713']],
            [['1379661', '4479579', '1800186'], ['985085118'], ['339765042']],
            [['24316446', '219651566', '501847856'], ['383709663'], ['90685795']],
            [['225365882', '478693885', '231765083'], ['155415482'], ['769649470']],
            [['86962133', '243793871', '284483399'], [0], [0]],
            [['167231135', '184523411', '549524850', '560979916', '612527302', '784911160'], [0], [0]],
        ];
    }
    static updateFeatures(envVariables: any) {
    }
}