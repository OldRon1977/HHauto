export class KKEventGirl {
    girlData: Record<string, unknown>;
    shards: number;
    id_girl: number;
    name: string = '';
    source: {
        name: string;
        anchor_source: {
            url: string;
            label: string;
            disabled: boolean;
        };
        // anchor_win_from is used both as array and as object in different code paths
        anchor_win_from: any;
        sentence?: string;
    };
}
