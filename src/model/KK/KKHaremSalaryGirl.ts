// Model for a harem girl whose salary is ready to collect.
// Wraps the underlying KKHaremGirl data with a readyForCollect flag.

import { KKHaremGirl } from "./KKHaremGirl";

export class KKHaremSalaryGirl {
    gData: KKHaremGirl;
    gId: number | string;
    readyForCollect: boolean;
}
