// UrlHelper.ts
//
// Simple URL query-string utilities. Wraps URLSearchParams for
// extracting parameters and provides a helper to append new
// key-value pairs to a URL string.
//
// Used by: PageHelper (tab detection), RewardHelper (troll ID),
//          PageNavigationService (building navigation URLs)

/** Extracts a single query parameter value from a query string. */
export function queryStringGetParam(inQueryString, inParam)
{
    let urlParams = new URLSearchParams(inQueryString);
    return urlParams.get(inParam);
}

export function url_add_param(url, param, value) {
    if (url.indexOf('?') === -1) url += '?';
    else url += '&';
    return url+param+"="+value;
}