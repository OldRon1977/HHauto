export class AmourAgent {
    static trollIdMapping = {};
    static lastQuestId = -1; //  TODO update when new quest comes
    static getEnv() {
        return {
            "www.amouragent.com": { name: "AA_prod", id: "hh_amour"}
        }
    }
    static getTrolls(languageCode: string) {
        return ['Latest',
            'Frank',
            'Adriana',
            'Tara',
            'Joseph Maloney'];
    }

    static updateFeatures(envVariables: any) {
        envVariables.isEnabledPantheon = false;// to remove when Pantheon arrives in AmourAgent
        envVariables.isEnabledSpreadsheets = false;
    }
}