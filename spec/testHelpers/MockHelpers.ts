export class MockHelper{

    static mockDomain(domain: string = 'www.hentaiheroes.com', page: string = '', search:string = '') {
        if(search != '' && search.indexOf('?') < 0) {
            search = '?' + search;
        } 
        if (page != '' && page.indexOf('/') < 0) {
            page = '/' + page;
        } 
        Object.defineProperty(window, 'location', {
            get() {
                return { 
                    hostname: domain,
                    href: 'https://' + domain + page + search,
                    origin: 'https://' + domain,
                    pathname: page,
                    search: search
                };
            },
        });
    }

    static mockPage(pageName: string, body:string = '') {
        document.body.innerHTML = `<!DOCTYPE html><div id="hh_hentai" page="${pageName}"><p>Hello world</p>${body}</div>`;
    }

    static mockHeroLevel(heroLevel: number) {
        if (!unsafeWindow.shared) unsafeWindow.shared = {} as any;
        unsafeWindow.shared.Hero = {
            name: "TOTO",
            infos: {
                level: heroLevel
            },
            energies: {}
        };
    }
    
    static mockEnergiesFight(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.fight = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesChallenge(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.challenge = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesKiss(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.kiss = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesQuest(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.quest = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesWorship(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.worship = {
            amount: amount,
            max_regen_amount: max
        };
    }

    static mockEnergiesDrill(amount: number, max: number) {
        unsafeWindow.shared.Hero.energies.drill = {
            amount: amount,
            max_regen_amount: max
        };
    }
}