// Game-variant configuration for Hentai Heroes (the primary/default variant).
// Provides domain-to-environment mapping, troll ID remapping, troll names,
// and quest data specific to the Hentai Heroes game variant.

export class HentaiHeroes {
    static spreadsheet = 'https://docs.google.com/spreadsheets/d/1kVZxcZZMa82lS4k-IpxTTTELAeaipjR_v1twlqW5vbI'; // zoopokemon
    static trollIdMapping = { 21: 19 };
    static sideTrollIdMapping = { 22: 20 };
    static lastQuestId = 2116; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.hentaiheroes.com": { name: "HH_prod", id: "hh_hentai" },
            "test.hentaiheroes.com": { name: "HH_test", id: "hh_hentai" },
            "nutaku.haremheroes.com": { name: "NHH_prod", id: "hh_hentai" },
            "thrix.hentaiheroes.com": { name: "THH_prod", id: "hh_hentai" },
            "eroges.hentaiheroes.com": { name: "EHH_prod", id: "hh_hentai" },
            "esprit.hentaiheroes.com": { name: "OGHH_prod", id: "hh_hentai" }
        }
    }
    static getTrolls(languageCode: string) {
        const trollList = ["Latest",
            "Dark Lord",
            "Ninja Spy",
            "Gruntt",
            "Edwarda",
            "Donatien",
            "Silvanus",
            "Bremen",
            "Finalmecia",
            "Roko Senseï",
            "Karole",
            "Jackson\'s Crew",
            "Pandora witch",
            "Nike",
            "Sake",
            "WereBunny Police",
            "Auga",
            "Gross",
            "Harriet",
            "Darth Excitor"
        ];
        switch (languageCode) {
            case "fr":
                trollList[2] = "Espion Ninja";
                trollList[11] = "Équipage de Jackson";
                trollList[12] = "Sorcière Pandora";
                trollList[15] = "Police des Lapines-Garous";
                trollList[19] = "Excitateur sombre";
                break;
            case "es":
                trollList[1] = 'Señor Oscuro';
                trollList[2] = 'Ninja espía';
                trollList[11] = 'Tripulación de Jackson';
                trollList[12] = 'Pandora Bruja';
                trollList[15] = 'Policía hombres-conejos';
                trollList[19] = 'Darth Excitador';
                break;
            case "it":
                trollList[1] = 'Signore Oscuro';
                trollList[2] = 'Spia Ninja';
                trollList[11] = 'Ciurma di Jackson';
                trollList[12] = 'Strega Pandora';
                trollList[15] = 'Polizia del Conigli Mannari';
                break;
            case "de":
                trollList[1] = 'Dunkler Lord';
                trollList[2] = 'Ninjaspion';
                trollList[11] = 'Jacksons Crew';
                trollList[12] = 'Pandora Hexe';
                trollList[15] = 'Wer-Kaninchen Polizei';
                trollList[19] = 'Darth Erreger';
                break;
        }
        return trollList;
    }
    static getSideTrolls(languageCode: string): {[key:number]: string} {
        const trollList = {
            20: "Arthur",
            21: "Venam Kharney"
        };
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
            [['612527302', '167231135', '560979916', '184523411', '549524850', '784911160'], [0], [0]],
            [['164866290', '696124016', '841591253'], [0], [0]],
            [['344730128', '735302216', '851893423'], [0], [0]],
            [['547099506', '572827174', '653889168'], [0], [0]],
            [['275226156', '280313988', '641009897'], [0], [0]],
            [['410383467', '931778650', '968097691'], [0], [0]],
        ];
    }

    static getSideTrollGirlsId(): { [key: number]: any } {
        return {
            20: [['666677364', '831625343', '851831359'], [0], [0]],
            21: [['124967437', '755350195', '855205805'], [0], [0]]
        };
    }
    static updateFeatures(envVariables: any) {
    }
}