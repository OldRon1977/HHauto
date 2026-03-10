// Raw API model for a girl in the player's harem.
// Maps directly to the harem girl object in the game's API responses,
// including level, affection, shards, grades, and salary timing.

export class KKHaremGirl {
    id_member: number | string;
    id_girl: number | string;
    shards: number;
    level: number;
    fav_graded: number;
    graded: number;
    ts_pay: number;
    affection: number;
    xp: number;
    id_places_of_power: number | string;
    awakening_level: number;
    date_added: string;
    id_girl_ref: number | string;
    nb_grades: number;
    class: string;
    figure: string;
    carac1: number;
    carac2: number;
    carac3: number;
    rarity: string;
    salaries: Record<string, unknown>;
    id_world: number | string;
    id_quest_get: number | string;
    element: string;
    name: string;
    release_date: string;
    anniversary: string;
    eye_color1: string;
    eye_color2: string;
    hair_color1: string;
    hair_color2: string;
    upgrade_quests: Record<string, unknown>;
    scene_paths: Record<string, unknown>;
    animated_grades: Record<string, unknown>;
    grade_offset_values: Record<string, unknown>;
    zodiac: string;
    preview_scenes: Record<string, unknown>;
    blessing_bonuses: Record<string, unknown>;
    Affection: number;
    can_upgrade: boolean;
    Graded: number;
    graded2: number;
    ico: string;
    avatar: string;
    black_avatar: string;
    armor: Record<string, unknown>;
    caracs: Record<string, number>;
    skill_tiers_info: Record<string, unknown>;
    grade_offsets: Record<string, unknown>;
    caracs_sum: number;
    orgasm: number;
    style: string;
    element_data: Record<string, unknown>;
    position_img: string;
    level_cap: number;
    salary: number;
    pay_time: number;
    pay_in: number;
    salary_per_hour: number;
    Xp: { cur: number; [key: string]: unknown };
    preview: string;
    awakening_costs: number;
    upgrade_link: string;
}
