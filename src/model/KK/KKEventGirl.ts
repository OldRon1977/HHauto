// Raw API model for a girl associated with an active event.
// Maps directly to the event girl object in the game's API responses,
// including shard count, source info, and navigation anchors.

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
